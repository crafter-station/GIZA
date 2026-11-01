---
name: seijaku-cinematic-3d
description: "Scroll-driven cinematic 3D journeys with Three.js, using techniques extracted and corrected from Seijaku: scroll-linked keyframe camera, editorial chapters over the canvas, orbital inspection mode, HDR pipeline (AO, god rays, bloom, grading), procedural materials with shader injection, GPU particles, non-blocking loading, and stable performance. Use when building or reviewing the pyramids 3D experience: scroll-to-camera, lighting cycle, pinned sections, animated exploded views, asset loading, or responsiveness."
license: MIT
metadata:
  author: "pyramids"
  version: "1.0"
  source: "Technical analysis of seijaku/ (Three.js 0.176). No code or assets are reused: the repository does not grant a reuse license."
---

# Seijaku · Cinematic 3D Journey

Seijaku is a Japanese house explored by scrolling: one continuous camera, typographic chapters over the scene, day/night and seasonal changes, a model-inspection mode, and editorial sections (materials, an exploded carpentry view, and a floor plan) built on the same scene. This skill explains **how** it is built, corrects poor practices, and adapts the approach for `pyramids`.

## When to Use

- Designing or implementing a 3D narrative where **scroll controls the camera** and text supports the journey.
- Render pipeline (HDR, tone mapping, AO, god rays, bloom, fog, shadows, environment).
- Procedural materials, shaders injected into PBR materials, particles, water, and vegetation.
- Progressive loading, shader warm-up, manual culling, adaptive DPR, and performance diagnosis.

Do not load it for an isolated CSS animation or a scene without a narrative (a viewer for a single model).

## Recommended Stack

| Need | Use | Rationale / alternative |
| --- | --- | --- |
| 3D engine | `three` pinned to an exact version (npm, not an unpinned CDN) | Injected shaders depend on internal chunk names that change between versions |
| Build | `vite` | Seijaku is a single 714 KB HTML file without a bundler: hard to maintain, with no tree-shaking or automatic hashing |
| Post-processing | `postprocessing` (pmndrs) + `n8ao` | Combines effects into fewer passes; mip-blur bloom is cheaper than `UnrealBloomPass`; N8AO is faster than `GTAOPass` |
| Scrolling | Native scrolling + custom smoothing; `gsap` + `ScrollTrigger` for editorial sections | GSAP has been free since 2025. Use `lenis` only if you need to normalize the mouse wheel |
| Compressed geometry | `gltf-transform` (CLI) + `MeshoptDecoder` | Mesh quantization + meshopt; `KTX2Loader` for large textures (GPU memory) |
| Picking / hotspots | `three-mesh-bvh` | Fast raycasts for educational interactive points |
| Realistic sun | `suncalc` + `Sky` (Three.js addon) | Real azimuth and elevation at Giza (29.98° N, 31.13° E) |
| Audio | Native Web Audio API | Synthesized ambience without files; start only after a user gesture |

## WebGPU/TSL Route (pyramids)

`pyramids` uses `WebGPURenderer` + TSL with automatic WebGL2 fallback, so `onBeforeCompile`, `ShaderMaterial`, `EffectComposer` and pmndrs `postprocessing` do **not** apply there. The code samples in the references are WebGL; translate them with the equivalence table in [webgpu-tsl](references/webgpu-tsl.md) before using them (node materials, shared `uniform()` nodes, `RenderPipeline` with `pass`/`ao`/`bloom`/`traa`/`godrays`, `instancedArray` + `compute`, `setAnimationLoop` as the only clock). It also documents the unit change in `suncalc@2` (degrees, azimuth from north).

## Architecture at a Glance

```
scroll ──► targetTime = progress · T ──► currentTime (smoothed, frame-rate independent)
                                              │
                         film.sample(t) ──────┤──► state s = { pos, look, fov, day, sunset, night, exposure, doors… }
                                              │
     ┌──────────────── scene ◄────────────────┤──── DOM chapters (opacity = window(t))
     │ site.update(s, camera): sun, lights,   │
     │ visible regions, time uniforms         │──── lazy loading: need('region') based on t
     ▼                                        │
  composer: Render → AO → god rays → bloom → grade/tonemap/sRGB/grano
```

Key principle: **everything derives from `t`**. Camera, lighting, doors, fog, text, and loading are computed from one value; this makes the scene rewindable, capturable at `?t=12.4`, and deterministic to test.

## Hard Rules

1. Use one clock and one `requestAnimationFrame` to orchestrate the scene, DOM, and secondary canvases (Seijaku has four independent rAF loops).
2. Use one WebGL context. Render secondary canvases (material gallery, exploded view) with the main renderer's `scissor`/`viewport` or render targets; do not create a new `WebGLRenderer` for each section (Seijaku creates three and cannot share textures or PMREM).
3. Use linear-space HDR lighting (`HalfFloatType`); apply exposure, tone mapping, and sRGB conversion **once** at the end.
4. Avoid per-frame allocations in the loop: reuse temporary vectors and colors, and do not run `filter/map/sort` over arrays each frame.
5. Do not change the number of lights at runtime: use a fixed pool assigned to the most relevant sources (avoids shader recompilation).
6. Smooth with `x += (target - x) * (1 - exp(-dt * k))`, with `dt` capped at 0.05 s.
7. Before showing the scene, compile shaders (`compileAsync`), upload textures (`initTexture`), and upload geometry in batches, yielding between batches.
8. Load by region: request only what the camera will see in the next few seconds of the journey.
9. Do not render unchanged content: use `dirty` flags for secondary canvases and skip rendering when an opaque editorial section covers the canvas.
10. Accessibility: respect `prefers-reduced-motion` (lower amplitude, no animated particles), support keyboard navigation, and provide useful HTML content if WebGL fails.

## Workflow

1. Define the route: list chapters with their `t` intervals, camera keyframes (position, look target, FOV), and exposure table. Validate the route with gray primitives before modeling.
2. Set up the pipeline (see [rendering-pipeline](references/rendering-pipeline.md)) and establish the key light; tune exposure per segment.
3. Build the scene with procedural geometry and compressed assets; create materials through shared factories ([materials-shaders](references/materials-shaders.md)).
4. Connect scrolling, chapters, poses, and inspection mode ([scroll-camera-story](references/scroll-camera-story.md)).
5. Optimize regions, lazy loading, warm-up, adaptive DPR, and `?perf` auditing ([performance-loading](references/performance-loading.md)).
6. Apply the [corrections](references/corrections.md) and verify cold loading, chapter jumps, exiting inspection mode, resizing, portrait mobile, a clean console, and the most expensive frame.

## Applying This to Pyramids

| Seijaku | Pyramid equivalent |
| --- | --- |
| Walk from the garden gate to the rooms | Arrival through the desert → Giza Plateau → Khufu entrance → Grand Gallery → King's Chamber |
| Exposure opening up indoors | Eye adaptation: full-sun exterior (low exposure) → torch-lit galleries (high exposure) |
| Lantern light pool | Torches and oil lamps in the passages (pool of ~8 point lights) |
| Falling leaves and dust motes in sunlight | Windblown sand and dust in shafts of light from the passages |
| Snow on upward-facing surfaces | Sand accumulated on the upper faces of blocks; erosion at the base |
| Sun rays masked by the sky | Rays along pyramid edges at dawn; beam through the ventilation shaft |
| Carpentry exploded view (craft) | Construction exploded view: blocks, ramp, Tura limestone casing, pyramidion |
| Noise-dissolve material transition | Limestone → Aswan granite → papyrus → gold → copper |
| Pond with Fresnel reflection | Nile / oasis; heat-distorted mirage on the horizon |
| Clickable floor plan | Clickable pyramid cutaway that jumps to a point in the journey |
| Seasons | Historical periods: construction (c. 2560 BCE), intact casing, present day |

For educational content, distinguish established facts from hypothetical reconstructions (for example, ramp construction methods) and cite sources in the interface.

## References

- [rendering-pipeline.md](references/rendering-pipeline.md): renderer, HDR, post-processing, sky, PMREM environment, fog, shadows, light pool, reflections.
- [scroll-camera-story.md](references/scroll-camera-story.md): scroll-to-time, keyframe interpolation, chapters, poses, inspection mode, pinned sections, typography, and exploded views.
- [materials-shaders.md](references/materials-shaders.md): procedural textures, composable shader injection, world-space effects, vegetation, instancing, GPU particles, and water.
- [performance-loading.md](references/performance-loading.md): staged startup, warm-up, regional loading, manual culling, adaptive DPR, assets, auditing, and QA.
- [corrections.md](references/corrections.md): Seijaku's mistakes and areas for improvement, and how to address them.
- [webgpu-tsl.md](references/webgpu-tsl.md): WebGL → WebGPU/TSL equivalents used by `pyramids`, WebGPU-specific rules, and `suncalc@2` units.

Use the `seijaku/` directory for study; do not copy its code, models, photos, or illustrations into the project.
