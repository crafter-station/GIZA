# Rendering Pipeline

The cinematic look comes from linear HDR, coherent physical lighting, exposure that changes with the narrative, and restrained post-processing. All code here is an independent reimplementation; numeric values are starting points to measure, not results.

## 1. Renderer

```js
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,            // MSAA is handled by the composer's render target
  stencil: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // later adjusted by adaptive DPR
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;   // Three.js addons: applied by OutputPass. With pmndrs: NoToneMapping
renderer.toneMappingExposure = 1;              // narrative exposure is written here every frame
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;  // check the console for deprecation warnings for your version's PCFSoftShadowMap
renderer.shadowMap.autoUpdate = false;         // update manually when the sun or a shadow caster moves

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.08, 4000);
```

- Keep `near` small (0.08) because the camera passes through doors and corridors; keep `far` large for the sky. If z-fighting appears at a distance, increase `near` outdoors or use `logarithmicDepthBuffer` (which has a cost).
- Seijaku uses `NoToneMapping` and writes ACES and sRGB conversion by hand in its final pass, then must "undo" tone mapping in the sky shader. With `renderer.toneMapping` + `OutputPass` (or `ToneMappingEffect`), none of those pieces are needed.

## 2. Post-Processing Chain

Correct order (everything remains linear HDR until the end):

```text
Render (HalfFloat, MSAA 4) → AO → god rays → bloom → grading (linear) → exposure + tone mapping → sRGB → grain/dither
```

### Recommended Option: pmndrs `postprocessing` + `n8ao`

```js
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect,
  ToneMappingMode, VignetteEffect, NoiseEffect, BlendFunction, GodRaysEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
composer.addPass(new RenderPass(scene, camera));

const ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
ao.configuration.aoRadius = 1.2;       // meters: scene scale, not pixels
ao.configuration.distanceFalloff = 0.5;
ao.configuration.intensity = 2;
ao.setQualityMode('Medium');
composer.addPass(ao);

const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 2.2, intensity: 0.25, radius: 0.6 });
const godRays = new GodRaysEffect(camera, sunDisc, { resolutionScale: 0.5, samples: 48, density: 0.95, decay: 0.95, weight: 0.4 });
const grain = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
grain.blendMode.opacity.value = 0.04;

const grade = new GradeEffect();   // exposure + saturation + warmth, defined below
composer.addPass(new EffectPass(camera, godRays, bloom, grade, new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
  new VignetteEffect({ darkness: 0.45, offset: 0.3 }), grain));
```

- With pmndrs, tone mapping is done by `ToneMappingEffect`: set `renderer.toneMapping = THREE.NoToneMapping` to avoid applying it twice, and apply exposure + grading in a custom `Effect` placed **before** `ToneMappingEffect` (see "Linear Grading").
- `sunDisc`: a small emissive mesh in the sun's direction; scene geometry occludes it so pyramid edges mask the rays.
- Use a high bloom threshold (≈2 in HDR) so only the sun, gold, specular reflections, and torches bloom; sunlit sand should not bloom. Lower it slightly at night and increase intensity.

### Minimal Option: Three.js Addons Only

`RenderPass → N8AOPass → ShaderPass(rays) → UnrealBloomPass → ShaderPass(grading) → OutputPass → ShaderPass(grain)`. `OutputPass` applies `renderer.toneMapping`, `toneMappingExposure`, and sRGB. Grain goes **after** sRGB encoding: it acts as dithering and removes banding in sky gradients.

### Linear Grading (Custom Pass)

With Three.js addons, use `ShaderPass` before `OutputPass` (exposure is handled by `renderer.toneMappingExposure`):

```glsl
uniform sampler2D tDiffuse; uniform float uSat, uDim; uniform vec3 uWarm; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat) * uWarm;  // warmth follows time of day
  c *= 1.0 - uDim;                   // narrative fade (end of chapter)
  gl_FragColor = vec4(c, 1.0);
}
```

With pmndrs, use an `Effect` (including exposure):

```js
import { Effect } from 'postprocessing';
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */`
      uniform float uExposure, uSat, uDim; uniform vec3 uWarm;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        outputColor = vec4(mix(vec3(l), c, uSat) * uWarm * (1.0 - uDim), inputColor.a);
      }`, { uniforms: new Map([['uExposure', new THREE.Uniform(1)], ['uSat', new THREE.Uniform(1)],
          ['uDim', new THREE.Uniform(0)], ['uWarm', new THREE.Uniform(new THREE.Vector3(1, 1, 1))]]) });
  }
}
```

### God Rays with a Sky Mask (Alternative Without a Sun Mesh)

A useful Seijaku technique: the sky material writes `alpha = 0`, and everything opaque writes `alpha = 1`. The ray pass marches from each pixel toward the sun's screen position, accumulating light only where the sample is sky and bright. Roofs and tree canopies mask the beams without extra geometry.

```glsl
uniform sampler2D tDiffuse; uniform vec2 uSun; uniform vec3 uTint;
uniform float uStrength, uDecay, uDensity, uThreshold, uAspect, uTime;
varying vec2 vUv;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  const int N = 48;
  vec2 stepUv = (vUv - uSun) * uDensity / float(N);
  vec2 uv = vUv - stepUv * hash12(gl_FragCoord.xy + fract(uTime) * 97.0); // jitter: fine noise instead of bands
  float w = 1.0, acc = 0.0, norm = 0.0;
  for (int i = 0; i < N; i++) {
    uv -= stepUv;
    vec4 s = texture2D(tDiffuse, uv);
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float bright = max(dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)) - uThreshold, 0.0);
    acc += min(bright, 6.0) * (1.0 - s.a) * inside * w;
    norm += w; w *= uDecay;
  }
  vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
  gl_FragColor = vec4(base.rgb + uTint * (acc / norm) * uStrength / (1.0 + dot(d, d) * 1.6), base.a);
}
```

- Run it at **half resolution** and add it to the frame (Seijaku runs at full resolution with 72 samples per pixel).
- On the CPU: project `camera.position + sunDir * 1000` to screen; if the sun is behind the camera (`dot(sunDir, forward) < 0`), set intensity to 0, and fade it when the sun moves out of frame.
- Requires an RGBA render target and no transparent material to contaminate the sky alpha; additive particles should write `alpha = 0`.

## 3. Exposure as a Narrative Tool

An interpolated `[t, exposure]` table simulates eye adaptation: exposure decreases outdoors in full sun and increases indoors. For pyramids: outdoors ≈0.8–1.0, descending corridor 1.6, torch-lit Grand Gallery 2.2. Write it to `renderer.toneMappingExposure` (Three.js addons) or `grade.uniforms.get('uExposure').value` (pmndrs).

Unlit objects (`MeshBasicMaterial` for distant silhouettes, as in Seijaku) appear brighter as exposure rises; divide their color by the current exposure so they remain stable.

## 4. Sky, Sun, and Environment

- Desert: use the `Sky` addon (Preetham) with `sunPosition`, and calculate the sun with `suncalc` for a real date and location; this is educational and free. Convention (north = −z, east = +x, suncalc azimuth measured from south toward west):

```js
import SunCalc from 'suncalc';
function sunDirection(date, out = new THREE.Vector3()) {
  const { altitude: alt, azimuth: az } = SunCalc.getPosition(date, 29.9792, 31.1342); // Giza
  return out.set(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt));
}
```

- If using an LDR panoramic photo as the sky, convert it to linear and compensate for exposure; better still, use actual HDR/EXR or the procedural `Sky`.
- Environment lighting: `PMREMGenerator.fromScene(skyScene, 0.04)` on a scene containing only the sky sphere. Regenerate **only** when the lighting key changes (`day·3 + sunset·2 + night`, threshold ≈0.08), and dispose of the previous render target.
- Fake interior environment: a box with emissive panels (a bright "window", a warm ceiling) processed by PMREM and assigned as `envMap` to interior materials. This gives believable reflections and fill light without GI. For pyramid chambers: a dark box with torch-colored panels.
- Keep outdoor `scene.environmentIntensity` low (≈0.3): the sun and hemisphere light provide illumination.

## 5. Lights and Shadows

- Use one shadow-casting `DirectionalLight` (2048–4096 map) whose frustum (±30 m) **follows the camera's focus**, plus a `HemisphereLight` (sky/ground) and an opposite-to-sun fill directional light without shadows.
- `shadow.intensity ≈ 0.8` lets shadows retain some bounced light; `normalBias` prevents acne on curved surfaces.
- When moving the shadow frustum, **align it to the texel grid** or shadows will shimmer (Seijaku does not):

```js
const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _f = new THREE.Vector3();
const ORIGIN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function placeSun(sun, sunDir, focus, distance = 90) {
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  _m.lookAt(ORIGIN, sunDir, UP);   // light-space rotation
  _mi.copy(_m).invert();
  _f.copy(focus).applyMatrix4(_mi);
  _f.x = Math.round(_f.x / texel) * texel;
  _f.y = Math.round(_f.y / texel) * texel;
  _f.applyMatrix4(_m);
  sun.target.position.copy(_f);
  sun.position.copy(_f).addScaledVector(sunDir, distance);
  sun.target.updateMatrixWorld();
}
```

- Set `renderer.shadowMap.needsUpdate = true` only when the sun, frustum, or animated shadow caster moves. Stone is static: with a stationary sun, its shadow does not need recomputing.

### Light Pool (Torches)

Seijaku defines dozens of lamps but only N real lights; each frame, the most relevant are assigned (intensity / distance²). The light count never changes, so shaders are not recompiled. Allocation-free version:

```js
class LightPool {
  constructor(scene, count = 8) {
    this.defs = []; this.best = [];
    this.lights = Array.from({ length: count }, () => { const l = new THREE.PointLight(0xffffff, 0, 8, 2); scene.add(l); return l; });
  }
  add(pos, color, intensity, distance = 8, group = 'all') {
    this.defs.push({ pos: new THREE.Vector3(...pos), color: new THREE.Color(color), intensity, distance, group, score: 0, gain: 1 });
  }
  update(camPos, gains) {
    const best = this.best, n = this.lights.length; best.length = 0;
    for (const d of this.defs) {
      d.gain = gains[d.group] ?? 1;
      d.score = d.gain * d.intensity / Math.max(0.25, d.pos.distanceToSquared(camPos));
      if (d.score <= 1e-4) continue;
      if (best.length < n) { best.push(d); continue; }
      let min = 0; for (let i = 1; i < n; i++) if (best[i].score < best[min].score) min = i;
      if (d.score > best[min].score) best[min] = d;
    }
    for (let i = 0; i < n; i++) {
      const l = this.lights[i], d = best[i];
      if (!d) { l.intensity = 0; continue; }
      l.position.copy(d.pos); l.color.copy(d.color); l.distance = d.distance; l.intensity = d.intensity * d.gain;
    }
  }
}
```

If assignment changes cause visible popping, keep each source in its slot while it remains among the best and fade its intensity briefly. Shadow-casting spotlights are expensive: use at most 1–2 in the pool.

## 6. Fog and Aerial Perspective

- Use `FogExp2` with density linked to camera height: dense at eye level and lighter in aerial views (otherwise aerial shots are buried in fog).
- Interpolate fog color over time of day: daytime (golden sand), sunset, night; in Egypt, add a warm tint for suspended dust.
- Render distant silhouettes (dunes, other pyramids) as unlit meshes tinted by fog color; they read as layers of atmosphere.

## 7. Water Reflections

`Reflector` renders the entire scene again: it is the most expensive effect. Guidelines:

- Moderate resolution (≈1024–1536), no MSAA; waves smooth it anyway.
- Set `visible = false` when the journey cannot see the water (decide by `t` or region).
- Replace its fragment shader with Fresnel (Schlick), wave slopes from a normal texture at 2–3 scales, absorption along the ray to the bottom, and sun specular:

```glsl
float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
float absorb = 1.0 - exp(-(uBedDepth / max(0.07, V.y)) * 1.05); // more water traversed at grazing angles
vec3 col = reflection * F + uDeep * (1.0 - F) * absorb + glint;
float alpha = F + (1.0 - F) * absorb * 0.92;   // transparent when looking downward: see beneath the surface
```

Cheaper distant Nile alternative: a physical material with a time-shifted `normalMap` and the sky `envMap`, without `Reflector`.
