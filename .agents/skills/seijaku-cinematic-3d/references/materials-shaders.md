# Materials, Shaders, and Effects

Seijaku builds most surfaces at runtime: code-generated textures, PBR materials from factories, and small GLSL injections into Three.js standard shaders. This creates variety with few megabytes of assets.

## 1. Material Factories

An object whose functions return configured materials while reusing the same textures:

```js
const M = {
  limestone: (tint = 0xe8dcc4) => new THREE.MeshPhysicalMaterial({ color: tint, map: T.lime, roughness: 1,
    roughnessMap: T.limeRough, normalMap: T.limeNormal, normalScale: new THREE.Vector2(0.8, 0.8), aoMap: T.limeAO }),
  granite:   () => new THREE.MeshPhysicalMaterial({ color: 0x5a524c, map: T.granite, roughness: 0.35,
    clearcoat: 0.6, clearcoatRoughness: 0.2 }),                     // polished sarcophagus
  gold:      () => new THREE.MeshPhysicalMaterial({ color: 0xffc66b, metalness: 1, roughness: 0.25 }),
  copper:    () => new THREE.MeshPhysicalMaterial({ color: 0xb87333, metalness: 1, roughness: 0.4, anisotropy: 0.5 }),
  sand:      () => new THREE.MeshPhysicalMaterial({ color: 0xd9b98a, map: T.sand, normalMap: T.sandNormal, roughness: 1 }),
  linen:     () => new THREE.MeshPhysicalMaterial({ color: 0xe9e1cf, roughness: 1, sheen: 0.5, sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xfff6e8) }),
};
```

- Use `sheen` for fabric and moss, `clearcoat` for polished stone, lacquer, or wet surfaces, and `anisotropy` for brushed metal.
- Use the interior environment `envMap` for interior materials and `scene.environment` for outdoor materials.
- Cache by parameters (`key → material`) when a factory is called hundreds of times: fewer programs and state changes.

## 2. World-Unit UVs

Textures should have the same size in meters throughout the scene. Dominant-normal "per-face" triplanar projection:

```js
function worldUV(geo, metresPerTile = 1) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2), k = 1 / metresPerTile;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv.slice(), 2));   // aoMap/lightMap read the second channel
  return geo;
}
```

Variant for long beams or blocks: align the U axis with the long dimension so grain or strata run along the piece.

## 3. Procedural Textures

Pipeline: fBm noise → height field → normal map (central differences) → cavity AO (areas below the local mean darken). Use one height field for normal, AO, and roughness; cache it.

```js
function normalFromHeight(H, w, h, strength = 2) {
  const out = new Uint8Array(w * h * 4), at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];  // wrap for tiling
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    out[i] = (-dx / len * 0.5 + 0.5) * 255; out[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
    out[i + 2] = (1 / len * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}
```

```js
const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
t.wrapS = t.wrapT = THREE.RepeatWrapping;
t.colorSpace = THREE.NoColorSpace;          // normals, roughness, AO, heights: data, NOT sRGB
t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
t.needsUpdate = true;
```

- Only color maps such as `map` and `emissiveMap` use `SRGBColorSpace`.
- For seamless noise, each octave's grid must wrap (`% n`) and frequencies must be integers.
- **Correction**: Seijaku generates several 512² textures on the main thread (though it yields between steps). Generate them in a Web Worker and transfer the `ArrayBuffer`, or better, bake them during the build and publish as KTX2:

```js
// texture.worker.js
self.onmessage = ({ data: { size, seed } }) => {
  const H = fbm(size, seed);                         // Float32Array
  const normal = normalFromHeight(H, size, size, 2.5);
  self.postMessage({ normal }, [normal.buffer]);     // transfer without copying
};
```

- Canvas 2D textures (wood grain, leaves, paper, hieroglyphs) → `CanvasTexture`. For an alpha mask that survives color conversion, draw the silhouette in white with `globalCompositeOperation = 'source-in'` and use it as `alphaMap` in `NoColorSpace`.

## 4. GLSL Injection into Standard Materials

`onBeforeCompile` lets you add logic to `MeshPhysicalMaterial` without losing PBR, shadows, fog, or instancing. Seijaku uses it for snow, moss, wear, caustics, leaf swaying, and fish swimming. A chainable helper that **fails loudly**:

```js
function inject(material, key, patch) {
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => { prev.call(material, shader, renderer); patch(shader); };
  material.customProgramCacheKey = () => prevKey.call(material) + '|' + key;
  return material;
}
function after(src, chunk, code) {
  const tag = `#include <${chunk}>`;
  if (!src.includes(tag)) throw new Error(`Chunk <${chunk}> does not exist in this Three.js version`);
  return src.replace(tag, `${tag}\n${code}`);
}
```

Rules:

- The `key` must encode **everything** written as a constant in GLSL (`strength.toFixed(2)`…); if different GLSL shares a key, Three.js reuses the wrong program.
- Shared uniforms must be the **same object** `{ value }` in every material (`shader.uniforms.uTime = U.time`): update once per frame for all.
- Always chain (`prev`): a material may combine sand + wear + reveal.
- Pin the Three.js version. Chunk names change; `after()` throws instead of silently disabling an effect (in Seijaku, `replace` does nothing when it cannot find the chunk).
- This technique does not work with `WebGPURenderer`; rewrite it using TSL nodes.

### World-Space Position and Normal (Instancing-Compatible)

```js
inject(mat, 'wpos', (sh) => {
  sh.vertexShader = after(sh.vertexShader, 'common', 'varying vec3 vWorldPos;');
  sh.vertexShader = after(sh.vertexShader, 'worldpos_vertex', `
    vec4 wp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    vWorldPos = (modelMatrix * wp).xyz;`);
  sh.fragmentShader = after(sh.fragmentShader, 'common', 'varying vec3 vWorldPos;');
});
// world-space normal in the fragment shader (after normal maps):
// vec3 wN = inverseTransformDirection(normal, viewMatrix);
```

### Sand Accumulation on Upward-Facing Surfaces (Seijaku's Snow Equivalent)

```js
inject(mat, 'sand', (sh) => {
  sh.uniforms.uSand = U.sand;                 // 0..1, shared
  sh.fragmentShader = after(sh.fragmentShader, 'common', 'uniform float uSand;');
  sh.fragmentShader = after(sh.fragmentShader, 'normal_fragment_maps', `{
    vec3 wN = inverseTransformDirection(normal, viewMatrix);
    float s = uSand * smoothstep(0.35, 0.85, wN.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.72, 0.52), s);
    roughnessFactor = mix(roughnessFactor, 1.0, s);
  }`);
});
```

This works because `diffuseColor` and `roughnessFactor` are consumed later in `lights_physical_fragment`.

### Stone Courses Without Geometry (From Seijaku's Roof Tiles to Pyramid Blocks)

Seijaku draws roof courses using `fract(y / courseHeight)` in world space. For pyramids, apply this to a low-poly mesh with procedural courses and joints that fade out when they would cause moiré at a distance:

```glsl
// fragment shader, after map_fragment (requires vWorldPos)
float cy = vWorldPos.y / 1.05;                       // average course height in meters
float fw = fwidth(cy), f = fract(cy);
float joint = smoothstep(0.0, 0.06 + fw, f) * (1.0 - smoothstep(0.94 - fw, 1.0, f));  // edges always increase
float row = floor(cy);
float along = dot(vWorldPos.xz, vec2(0.7071)) / 1.4 + hash11(row) * 3.0;   // vertical joints shifted per course
float fa = fwidth(along), vj = smoothstep(0.0, 0.04 + fa, fract(along));
float fade = 1.0 - smoothstep(0.35, 0.7, max(fw, fa));                     // fade lines at distance to avoid aliasing
diffuseColor.rgb *= mix(1.0, mix(0.55, 1.0, joint * vj), fade);
diffuseColor.rgb *= 0.9 + 0.2 * hash11(row * 17.0 + floor(along));         // vary each block's tone
```

General principle (also used for Seijaku's granite grain): **fade procedural detail according to its on-screen frequency** (`fwidth`).

### Other Useful Patterns

- **Height-based wear**: darken and desaturate near the ground (`1 - smoothstep(0, 0.55, vWorldPos.y)`) with cell-based mottling; add a soot line under an eave. For pyramids: sand at the base, torch soot on gallery ceilings.
- **Hieroglyph reveal**: mask in `emissiveMap` + `totalEmissiveRadiance += uGlow * mask * smoothstep(uReveal - 0.1, uReveal, noise)` in `emissivemap_fragment`, with `uReveal` tied to chapter progress.
- **Vertex glow attribute**: a `glow` attribute (0..1) computed from geometry (e.g. inner lamp faces) adds emission scaled by a global "sunset" uniform.
- **Body deformation**: Seijaku animates fish by displacing vertices with a wave whose envelope grows toward the tail, applied **after** `instanceMatrix` in `project_vertex`, with uniforms written in each mesh's `onBeforeRender`. This can suit Nile boat sails or banners.
- **Caustics**: tileable filament texture (sum of sines with integer frequencies), sampled twice with different offsets and combined using `min()`; project onto world `xz` and limit to areas beneath the water surface.

## 5. Vegetation (Palms, Papyrus, Reeds)

- Use instanced quads for leaf clusters with `alphaTest: 0.5`, `alphaToCoverage: true` (smooth edges from render-target MSAA), and `side: DoubleSide`.
- Vertex-shader sway phase comes from the instance position (`instanceMatrix[3].xyz`): no extra attributes needed.
- **Shadows must move with leaves**: use `customDepthMaterial` with the same sway injection and alpha mask.
- Transmitted light: back-light term `pow(max(dot(viewDir, sunDir), 0.0), 4.0)` added as emission, multiplied by sun shadow (otherwise shadowed leaves glow), and warmer than reflected light. Against the sun, darken diffuse so the canopy reads as a silhouette.
- Distant vegetation: same material with darker, flatter color and less transmission; otherwise canopies look like pale ghosts at 15–20 m.
- Per-instance variation should affect brightness and a little warmth (`setColorAt`), never hue.
- Exclude alpha cards from the AO pass: AO does not see alpha clipping and turns them into dark rectangles (Seijaku hides them only during that pass).

## 6. Instancing

- Use `InstancedMesh` for repeated objects (blocks, rocks, roof tiles, palms), with `setColorAt` for variation.
- Call `instancedMesh.computeBoundingSphere()` after writing matrices: otherwise frustum culling uses the sphere of a single instance, and the mesh may disappear or never be culled.
- Do not instance all ~2.3 million of Khufu's blocks: use simple geometry with procedural courses at a distance and real blocks only near the camera (entrance, base, exploded view).

## 7. GPU Particles

Seijaku pattern: `InstancedBufferGeometry` with a quad and random per-instance attributes; **all motion is a closed-form vertex-shader formula** driven by `uTime`, so the CPU does nothing per frame.

```js
function particleField(count, attrs, material) {
  const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.attributes.position); g.setAttribute('uv', quad.attributes.uv);
  for (const [name, array, size] of attrs) g.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  g.instanceCount = count;
  const m = new THREE.Mesh(g, material); m.frustumCulled = false; return m;   // reposition around the camera
}
```

Sunlit suspended dust (motes in a shaft of light):

```glsl
// vertex
attribute vec4 aRand; uniform float uTime, uBox; uniform vec3 uCam;
varying vec2 vUv; varying float vFade; varying vec3 vDir;
void main() {
  vec3 drift = vec3(uTime * (0.03 + aRand.w * 0.05), sin(uTime * 0.2 + aRand.w * 30.0) * 0.25, uTime * 0.02);
  vec3 rel = mod(aRand.xyz * uBox + drift - uCam, uBox) - uBox * 0.5;   // camera-following box
  vec3 wp = uCam + rel;
  float d = length(rel);
  vFade = (1.0 - smoothstep(uBox * 0.28, uBox * 0.5, d)) * smoothstep(0.35, 0.9, d);  // no edges or motes stuck to the eye
  vDir = normalize(wp - cameraPosition);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  mv.xy += position.xy * (0.006 + aRand.w * 0.01);                            // view-space billboard
  gl_Position = projectionMatrix * mv; vUv = uv;
}
// fragment
uniform float uGain; uniform vec3 uSunDir, uColor; varying vec2 vUv; varying float vFade; varying vec3 vDir;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float core = exp(-dot(q, q) * 5.0);
  float forward = pow(max(dot(vDir, uSunDir), 0.0), 3.0);   // forward scattering: brighter when looking toward the sun
  gl_FragColor = vec4(uColor * core * vFade * uGain * (0.1 + 2.4 * forward), 0.0);  // alpha 0: does not contaminate the sky mask
}
```

Material: `transparent: true, depthWrite: false, blending: AdditiveBlending`. For falling leaves, Seijaku uses quads (a sprite never turns edge-on) that rotate around their long axis and slide faster edge-on; wind is integrated on the CPU as one shared offset so direction changes do not make particles jump. For pyramids: windblown ground-level sand, dust in passages, and torch sparks.

With `prefers-reduced-motion`, freeze particle time at a fixed value.

## 8. Shader Noise

Avoid `fract(sin(dot(p, …)) * 43758.5453)`: on mobile `mediump` it creates patterns and banding. Use a sine-free hash:

```glsl
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
```

Never use `smoothstep(a, b, x)` with `a >= b`: GLSL leaves the result undefined (it may work on some GPUs but not others). For a descending ramp, write `1.0 - smoothstep(b, a, x)`.
