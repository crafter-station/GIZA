# Production Performance and Validation

## Observed Quality, Not Assumed Quality

| Parameter | `rt` | `high` | `ultra` |
| --- | --- | --- | --- |
| FFT per cascade | 256,256,128,128 | 512,256,256,256 | 512,256,256,256 |
| Water angular segments | 400 | 640 | 640 |
| Clouds: `steps` parameter | 80 | 96 | 128 |
| Light/detail steps | 5 / 2 | 6 / 3 | 6 / 3 |
| Checkerboard | yes | no | no |
| Preferred HDR | R11F_G11F_B10F | RGBA16F | RGBA16F |
| Requested MSAA | 4 | 4 | 4 |
| Effective cloud divisor | 2 explicit | 1 explicit | 1 explicit |

`high` and `ultra` render clouds at full resolution; `rt` uses half width and height. `high` was dynamically checked at 640×360 with a 640×360 cloud buffer as well. `steps` is not the exact maximum number of iterations: the march has a cap of 320 and checks `i >= steps*3`. Document controls according to their actual behavior.

Live mode's dynamic resolution initially caps DPR at 1.5. It uses an exponential average of frame intervals: scale drops by ×0.88 below ~26 FPS, rises by ×1.08 above 50, with a 0.5 minimum and a 2.5 s wait between effective changes. This is a heuristic aimed at ~30 FPS on slow devices, not a 60 FPS guarantee. An explicit `scale` disables this adaptation.

## Proposed Initial Budget for Pyramids

These are **design targets to validate**, not Open Water results or universal limits:

- Target desktop: total frame p95 ≤16.7 ms when aiming for 60 FPS; reference mobile: p95 ≤33.3 ms for 30 FPS. Also record p50, p99, and long frames so an average does not hide stutter.
- Keep headroom within the budget: when the GPU is near its limit, reduce effects before an input or load spike causes stutter. CPU and GPU overlap; do not sum their durations as if they were always serial.
- As a first hypothesis, a few hundred draw calls and hundreds of thousands of visible triangles; pixel cost, shadows, and transparency can dominate even below that. Replace these figures with measurements on the target device.
- Make the first chapter independently downloadable; start with a hypothesis of ≤5 MB for critical compressed assets. Measure time to the first interactive scene, not only download time. Adjust for network, device, and required fidelity.

## Adapt to the Bottleneck

| Evidence | Useful response | Insufficient response |
| --- | --- | --- |
| GPU is resolution-sensitive | Fewer volume/AO/bloom pixels, fewer steps, capped DPR | Reduce triangles only |
| Many CPU draw calls | Instance/batch by material and region; share resources | Lower DPR |
| Too many vertices | LOD, culling, simplification, and fewer instances | Compress the GLB only |
| Expensive transparency | Reduce overlapping area, tighten quads, reduce actual instance count | Combine everything into one draw call |
| High memory use | KTX2, size by use, release chapters and render targets | Reduce JPEG size without changing GPU dimensions |
| Transition jank | Profile CPU work, loading/decoding, and shader compilation | Measure only the stable scene |

Control quality with a window of valid samples, separate thresholds for increasing/decreasing quality, cooldown, and a cap on oscillation. Exclude hidden-tab, startup, compilation, and resize events from normal decisions; measure them separately. A resize recreates targets and clears history: do not change scale continuously. Create one effective dimension per backend using CSS size and DPR once; avoid multiplying DPR in both `setPixelRatio` and `setSize`.

Suggested priority: preserve monument geometry, labels, and responsiveness; lower dust resolution/steps, secondary shadows, and bloom; then reduce LOD and DPR if needed. Changing FFT or large geometry requires resource recreation and must not happen every frame.

## Memory and Capabilities

Estimate each resource as `width * height * bytesPerPixel * samples * copies`. Include depth, resolve, history buffers, and other passes. Full 2D mipmaps add roughly 1/3; a 3D mip pyramid adds roughly 1/7. `RGBA16F` is 8 B/texel, `RGBA32F` is 16, and `R11F_G11F_B10F` is 4. A 1920×1080 RGBA16F color target with 4 samples uses ~63.3 MiB for color, plus ~15.8 MiB for resolve; depth and the rest of the engine are not included.

Validate `MAX_TEXTURE_SIZE`, `MAX_3D_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE`, samples per format, and framebuffer completeness before allocation. Supporting float textures does not mean every float format can be rendered/filtered. In WebGL2, check filtering requirements for 32-bit formats and use nearest/manual filtering where appropriate; do not claim all half-float textures require the same extension. `R11F_G11F_B10F` has no alpha or negative values: it is suitable for positive opaque radiance, not every field or composite.

Reuse arrays, matrices, and buffers in hot paths. In the original, gradual weather changes can rebuild the spectrum and repeatedly run `computeStats()` with 4,000 CPU samples; if profiling shows this is a bottleneck, use caching/sensitive thresholds, lower frequency, or precalculate with controlled error.

## Measure Without Changing What Is Measured

- Capture normal interaction with `requestAnimationFrame`, without `preserveDrawingBuffer` or `gl.finish()` per frame. Record CSS size and actual framebuffer size, quality, browser, GPU, backend, and scenario.
- Use asynchronous GPU queries when available. Group all sections in each frame and do not double-count parents and children. Discard disjoint samples and cap the pending queue. Without the extension, report only available CPU/presentation metrics.
- Use Open Water's reduced probe as a readback pattern: render 2×1 -> PBO -> fence -> poll without waiting -> read when ready. Accept several frames of latency if the logic allows it. Do not use delayed results for a collision that requires immediate response.
- `tools/perf.mjs` uses `?render` and `gl.finish()`: it selects `high` by default, not `rt`, and serializes CPU/GPU work. It is useful for isolated export cost; it does not prove web responsiveness. Its sum of averages also does not always equal frame time; see the audit.
- Puppeteer/headless supports capture and testing, but does not certify FPS on other devices. Do not disable GPU watchdogs/locks in an attempt to test real compatibility.

## Tests with Observable Criteria

1. Cold load: visible content, loading progress, recoverable errors; compilation must not block the interface indefinitely.
2. Stable scene and most expensive transition: fixed sample with explicit warm-up; measure percentiles during a reproducible route and record adapted resolution.
3. Context loss: stop the loop; restore all resources and history or switch to navigable fallback without duplicating listeners. If available, test with `WEBGL_lose_context` in development.
4. Repeated resize, orientation changes, and hidden container: zero dimensions suspend rendering; memory must not grow with each reconstruction.
5. Fast camera movement, cuts, entering interiors, and sun changes: no persistent ghosts, non-finite artifacts, or incorrectly inherited exposure.
6. Keyboard, touch, reduced motion, pause, and muted audio: content remains complete. A control must not disappear while focused.
7. Visual comparison: same camera, seed, time, exposure, and warm-up before/after. Review silhouette, depth, distant texture, shadows, and readability. Do not call a render scientifically accurate merely because it looks like a photo.

Sources: [main.js](../../../../open-water/src/main.js), [profiler.js](../../../../open-water/src/profiler.js), [probe.js](../../../../open-water/src/ocean/probe.js), [perf.mjs](../../../../open-water/tools/perf.mjs).
