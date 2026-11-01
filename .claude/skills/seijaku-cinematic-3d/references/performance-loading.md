# Performance, Loading, and QA

Seijaku's responsiveness does not come from a lightweight scene (it is heavy), but from **avoiding unnecessary work** and **doing expensive work before the user sees it**. Figures are starting points: measure on target devices.

## 1. Staged Startup: The Loader Never Freezes

```js
let sliceStart = performance.now();
async function checkpoint(progress) {
  if (progress !== undefined) loader.progress(progress);
  if (performance.now() - sliceStart < 8) return;          // yield only after a slice exceeds ~8 ms
  if (globalThis.scheduler?.yield) await scheduler.yield();
  else await new Promise((r) => setTimeout(r, 0));
  sliceStart = performance.now();
}
```

Call `await checkpoint(p)` between expensive batches (each procedural texture, each scene region, each instance batch). Seijaku calls it after nearly every line; it is enough to yield between batches that take more than a few milliseconds.

Build order: environment → materials/textures → compressed geometry (`await MeshoptDecoder.ready`) → scene → particles → post-processing → warm-up → first frame → `loader.done()`.

## 2. Warm Up Before the First Frame

Without this, the first scroll stutters due to shader compilation and texture/buffer uploads.

```js
async function warmUp() {
  renderAt(startT, 0, true);                         // put the scene in its first-frame state without drawing
  // 1) upload visible textures to the GPU, one at a time
  const textures = new Set();
  scene.traverseVisible((o) => {
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      for (const u of Object.values(m.uniforms ?? {})) if (u.value?.isTexture) textures.add(u.value);
    }
  });
  for (const t of textures) {
    const img = t.source?.data;
    if (t.isRenderTargetTexture || !img?.width || img.complete === false) continue;
    renderer.initTexture(t); await checkpoint();
  }
  // 2) compile scene shaders and post-processing shaders
  await renderer.compileAsync(scene, camera);
  // (passes: compile their full-screen materials on a quad in a helper scene)
  // 3) upload geometry in batches to a 1×1 target
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), aux = new THREE.Scene();
  const meshes = [], lights = [];
  scene.updateMatrixWorld();
  scene.traverseVisible((o) => { if (o.isMesh && !o.isReflector) meshes.push(o); if (o.isLight) lights.push(o); });
  const prevTarget = renderer.getRenderTarget(), prevShadow = renderer.shadowMap.needsUpdate;
  renderer.shadowMap.needsUpdate = false; renderer.setRenderTarget(rt);
  try {
    for (let i = 0; i < meshes.length; i += 24) {
      aux.children = lights.concat(meshes.slice(i, i + 24));   // borrow references without changing their parents
      renderer.render(aux, camera); await checkpoint();
    }
  } finally {
    aux.children = []; renderer.setRenderTarget(prevTarget); renderer.shadowMap.needsUpdate = prevShadow; rt.dispose();
  }
}
```

Lights must be present at compile time: the number of lights is part of the shader program. This is why the light pool has a fixed size.

## 3. Region Loading Ahead of the Camera

```js
const opened = new Set(), queue = new Map();
function whenOpen(region, fn) { opened.has(region) ? fn() : (queue.get(region) ?? queue.set(region, []).get(region)).push(fn); }
function need(region) {
  if (opened.has(region)) return; opened.add(region);
  for (const fn of queue.get(region) ?? []) fn(); queue.delete(region);
}
// in the loop, a few seconds ahead in the journey:
if (t > 4.5) need('gallery'); if (t > 17) need('kingsChamber'); if (t > 20) need('sarcophagus');
```

- Texture and model placeholders are created as empty objects when building the scene and populated when their region opens (`Texture` exists from the start; the image arrives later and sets `needsUpdate = true`).
- A global pending counter feeds loader percentage and an `isReady()` function for automated tests.
- In inspection mode or when seeking, open all regions the view may need.

## 4. Manual Culling by Region

Frustum culling does not know that a wall hides an entire garden. Seijaku assigns each top-level object to a region by position and disables regions based on `t`:

```js
const vis = { exterior: t < 7 || t > 30, gallery: t > 5 && t < 20, chamber: t > 15, roof: !underCeiling(t) };
for (const [obj, region] of regions) obj.visible = inspecting || vis[region];
```

- Dense layers that always remain in the frustum (thousands of roof tiles) belong in their own region, which is disabled indoors.
- Enable water with `Reflector` only when the journey can see it: it renders the entire scene a second time.
- Make everything visible again in orbital inspection mode.

## 5. Do Not Draw What Has Not Changed

- Secondary canvases use `dirty`: redraw only if progress, size, scroll, or a texture changes. `webglcontextrestored` and `document.fonts.ready` mark them dirty.
- If an opaque section covers the main canvas, do not call `composer.render()`.
- Recompute shadows and environment PMREM only when their inputs change.
- An `IntersectionObserver` with a large `rootMargin` (100–120%) initializes each heavy section shortly before it enters the viewport, but not earlier.

## 6. Adaptive Resolution That Locks

```js
let pr = Math.min(devicePixelRatio, 1.5), acc = 0, n = 0, steps = 0, locked = false;
function adaptPixelRatio(dt) {
  if (locked) return;
  acc += dt; if (++n < 120) return;
  const avg = acc / n; acc = 0; n = 0; steps++;
  const max = Math.min(devicePixelRatio, 2);
  if (avg > 0.026 && pr > 1) setPR(Math.max(1, pr - 0.15));        // > ~38 ms: lower
  else if (avg < 0.012 && pr < max) setPR(Math.min(max, pr + 0.1)); // < ~83 fps: raise
  if (steps >= 6) locked = true;
}
function setPR(v) { pr = Math.round(v * 100) / 100; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); }
```

It adjusts early and then **locks**: changing pixel ratio mid-journey reallocates all render targets and causes flicker. It can be unlocked again in inspection mode.

Other quality reductions that are hard to notice:

- AO at ~0.5–0.6 resolution; god rays at 0.5.
- `Reflector` without MSAA and at moderate resolution.
- Shadows: update at half frequency when the camera is far away (orbit).
- Particles: fewer instances on mobile (`count` based on `innerWidth * innerHeight`).

## 7. Loop Hygiene

- Use one `requestAnimationFrame`. In order: capped `dt`, scene clock, camera, `site.update`, chapter DOM, secondary canvases, render.
- After a long task, the rAF timestamp may be **earlier** than the last recorded timestamp: use `last = Math.max(last, now)` so `dt` is never negative.
- No `new THREE.Vector3()` or new arrays per frame; keep temporaries at module scope.
- Use `renderer.info.autoReset = false` + `info.reset()` at the beginning of a frame to measure the whole frame across multiple passes.
- On `webglcontextlost`, call `preventDefault()`, stop the loop, and show HTML content; on `webglcontextrestored`, rebuild or reload.

## 8. Assets

- **Geometry**: `gltf-transform optimize in.glb out.glb --compress meshopt` (quantization + meshopt). Seijaku must load meshoptimizer's decoder separately because the copy bundled with Three.js was too old for its encoder: use the same encoder and decoder version.
- **Large 3D textures**: KTX2 (Basis UASTC for normals, ETC1S for color) with `KTX2Loader.setTranscoderPath(...).detectSupport(renderer)`. A 2048² WebP uses 16 MB in GPU memory (plus mipmaps); KTX2 stays compressed in memory.
- **DOM photos**: responsive WebP (640/960/1600) with `srcset`, `loading="lazy"`, and `decoding="async"`; for textures created in JS, choose the smallest width ≥ `CSS width · min(dpr, 1.5)`.
- Use content-hashed filenames (`stone.3f9a1c.webp`) for immutable caching; Vite does this automatically.
- Use URLs relative to the document (`new URL(path, location.href)` or Vite imports): avoid paths beginning with `/`, which fail when publishing under a subpath (GitHub Pages).
- Self-host fonts with `font-display: swap` and preload the primary font; WebGL must never wait for fonts (except 3D text that uses them).
- Add a CI check: all referenced assets exist, no root-absolute links, responsive image sets are ordered, and below-the-fold images are lazy-loaded.

## 9. `?perf` Audit and Debug Flags

Seijaku adds a `?perf` mode that sends no telemetry. It records startup phases, long tasks (`PerformanceObserver` for `longtask`), downloaded resources, CPU per frame and frame interval (median and p95), draw calls, triangles, geometries, textures, and programs in bounded circular buffers, then serializes at most once per second to `document.documentElement.dataset.performanceAudit`. Copy the idea.

URL flags that speed up work and testing:

| Flag | Effect |
| --- | --- |
| `?t=12.4` | Fix journey time; no loader or UI transitions (captures) |
| `?cam=x,y,z,tx,ty,tz,fov` | Manual camera for inspecting a corner |
| `?orbit=theta,phi,dist` | Open inspection mode directly |
| `?autoplay=1` | Play the journey automatically (video, demo) |
| `?noao`, `?nobloom`, `?noshadow`, `?noreflect` | Isolate the cost of each effect |
| `?perf` | Enable the audit |

Expose `window.__isReady()` (more than 3 frames, fonts loaded, sky ready, no pending assets) so Playwright can wait for the correct state before capturing.

## 10. Checklist

- Cold load with empty cache and throttled network: loader progresses and never freezes; no tasks over 50 ms after the loader.
- Complete journey in both directions: no stutter entering new regions; textures never appear black.
- Jumps from the floor plan and menu: camera ends at a usable view.
- Enter and exit inspection mode: journey resumes where it left off; `Escape` works.
- Mobile resize and rotation: FOV, 3D text, and chapters adapt; nothing widens the page.
- `prefers-reduced-motion`: no mouse parallax, particles frozen, static loader.
- Clean console (no chunk or texture warnings), and stable `renderer.info.programs.length` throughout the journey (if it grows, something is recompiling).
- Measure and record the most expensive frame (device, effective resolution, backend) as an actual result, separate from target budgets.
