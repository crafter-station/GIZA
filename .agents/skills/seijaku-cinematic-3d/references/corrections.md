# Corrections to Seijaku

Seijaku is a strong visual project, but it is packaged as a single ~714 KB `index.html`, generated and edited many times. These are practices **not** to copy, and what to do instead. Line references to `seijaku/index.html` are approximate.

## Architecture

| Seijaku | Problem | Do this instead |
| --- | --- | --- |
| Everything (CSS, shaders, 6,000 lines of JS, asset registries) in one HTML file, with no bundler | Hard to review, no tree-shaking, no automatic hashing, no types | Vite + ES modules: `render/`, `scene/`, `materials/`, `story/`, `audio/`, `config/` |
| three and meshoptimizer from jsDelivr through an import map | GLSL injections depend on version-specific internal chunks; an unpinned CDN can silently break | Pin `three` to an exact npm version; make the `after()` helper throw if a chunk is missing |
| Three `WebGLRenderer` instances (journey, materials, exploded view; ≈L8105, L7824, L7898) | Three contexts: tripled memory, no shared textures or PMREM (noted in the code itself), mobile context limit | One renderer: `setScissorTest` + `setViewport` on a full-screen canvas, or render target displayed on a plane |
| Four independent rAF loops (scene, Story, ink/floor plan, loader) | Update order is not guaranteed; repeated layout reads | One ticker that calls each subsystem in a fixed order |
| `aura-preview-performance-controller` script replacing global `requestAnimationFrame` and `setInterval` (≈L1) | Editor residue; creates objects in a `Map` on every frame | Remove it from production |
| Debug flags read with `new URLSearchParams` inside material factories | URL parsed on every call; debug logic mixed into rendering | Parse the URL once in `config.js` and pass an options object |
| Magic numbers and stale comments ("old 1.05 threshold", "stale uDim from the 21 s cut") | No one knows which value is current | Put chapter, exposure, and pose tables in a named configuration file |
| `UI.toggleAmbience` retains a noise synthesizer that is never used because `Ambience` replaces it | Dead code | Remove it |

## Rendering

| Seijaku | Problem | Do this instead |
| --- | --- | --- |
| `NoToneMapping` + hand-written ACES + manual sRGB conversion; sky "inverts" tone mapping to compensate | Three coupled pieces: changing the curve requires retuning the sky | `renderer.toneMapping = AgXToneMapping` + `OutputPass`, or pmndrs `ToneMappingEffect`; procedural sky or actual HDR |
| Full-resolution god rays with 72 samples per pixel | Most expensive per-pixel pass after AO | Half resolution and 32–48 jittered samples, or `GodRaysEffect` with `resolutionScale: 0.5` |
| `GTAOPass` + `UnrealBloomPass` + several `ShaderPass` instances | Many full-screen passes | pmndrs `EffectPass` (merges effects) + mip-blur bloom + N8AO; measure before and after |
| Shadow frustum follows camera (`camera.position * 0.6`) without texel alignment | Shadows shimmer and flicker while moving | Align the center to the texel grid in light space (see `placeSun`) |
| `shadowMap.autoUpdate = false` but `needsUpdate = true` on nearly every frame | Equivalent to updating every frame (justified there by moving leaves) | In a static stone scene, update only when the sun, frustum, or animated shadow caster moves |
| Context loss handled only on secondary canvases | Main canvas turns black | Handle `webglcontextlost` with `preventDefault()` + HTML fallback on the main canvas |

## Shaders

| Seijaku | Problem | Do this instead |
| --- | --- | --- |
| `smoothstep` with reversed edges in GLSL (sky, motes, leaves, e.g. `smoothstep(uS*0.5, uS*0.28, d)`) | Undefined by the GLSL specification; works on some GPUs but not others | `1.0 - smoothstep(smaller, larger, x)` |
| `fract(sin(dot(...)) * 43758.5453)` hash in several shaders | Patterns and banding on mobile GPUs with `mediump` | Sine-free hash (Hoskins), see materials-shaders §8 |
| Unchecked `String.replace` of `#include <…>` | If a chunk is renamed, the effect silently disappears | Helper that throws; pin the Three.js version |

## Performance

| Seijaku | Problem | Do this instead |
| --- | --- | --- |
| `LightPool.update` runs `filter → map → sort → slice` on all sources every frame | Garbage for GC and full sorting each frame | Partial selection over preallocated arrays (see rendering-pipeline §5); optionally recalculate only when the camera moves |
| `new THREE.Vector3()` and `.clone()` per frame in camera pose and `site.update` | GC pressure and micro-stutters | Reuse module-level temporaries |
| Animated `filter: blur()` on text chapters over WebGL | Repaints text every frame on a layer already being composited | Use only `opacity` and `transform` |
| `getBoundingClientRect` for all sections every frame, interleaved with style writes | Risk of layout thrashing | Use `IntersectionObserver` to identify active sections; read everything, then write |
| 512² procedural textures generated on the main thread at startup | Seconds of CPU time on mobile, even with yields | Web Worker with transferable `ArrayBuffer`, or bake them during the build as KTX2 |
| Large 3D textures in WebP | Decompressed to full RGBA in GPU memory | KTX2/Basis for material textures; WebP only for DOM photos |
| `#sizer` with `height: calc(100vh + 23800px)` | Journey duration varies with screen size; `100vh` jumps on mobile | Use `svh` units |
| Long smooth-scroll jumps | Traverse and load every intermediate region | Fade + instant jump + load the destination region |
| Custom GLB parser to avoid `URL.createObjectURL` | A lot of code for an edge case | Standard `GLTFLoader` + `MeshoptDecoder`; custom parser only if CSP forbids `blob:` |

## Accessibility and UX

| Seijaku | Problem | Do this instead |
| --- | --- | --- |
| `cursor: none` on the entire `body` with a custom cursor | Magnifier, tablet, and accessibility users lose the cursor | Use a custom cursor only with `(hover: hover) and (pointer: fine)`; never hide the native cursor on controls |
| Header contrast calculated by reading GPU pixels | High complexity for a predictable result | Use `data-theme` per section and chapter; read pixels only if the background is unpredictable |
| Fonts loaded from Google Fonts | Third-party request and network dependency | Self-host with `font-display: swap` |
| `window.__scene`, `__camera`, `__renderer`, etc. always exposed | Unnecessary production global surface | Expose only behind a development flag (`import.meta.env.DEV`) |

## What to Keep

- All state derived from one `t`: rewindable, capturable, and testable.
- Exponential smoothing with capped `dt` and protection against negative `dt`.
- Hermite interpolation with explicit times and dense keyframes where the camera slows.
- Narrative exposure by segment (eye adaptation).
- Fixed-size light pool: shaders are not recompiled.
- Warm up textures, shaders, and buffers before removing the loader; stage startup work.
- Load regions ahead of the camera and manually cull by region.
- Do not render when a section covers the canvas; use `dirty` flags for secondary canvases.
- Adaptive DPR that locks after adjustment.
- Chainable GLSL injections with a correct `customProgramCacheKey` and uniforms shared by reference.
- Particles with closed-form vertex-shader motion.
- Sky mask in the alpha channel for god rays.
- `?perf` mode with bounded buffers and URL flags for QA.
