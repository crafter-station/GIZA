# Sources, Provenance, and Validation Scope

Analysis performed on **October 31, 2026**, the user's local date (America/Lima). `open-water` was studied; `seijaku` is outside the scope of this extraction. The goal is a reusable technical skill, not to copy the product or implement `pyramids` yet.

## Local Primary Evidence

Paths are relative to the `pyramids/` root; symbols are more stable anchors than the audit's line numbers.

| File | Reviewed symbols/aspects |
| --- | --- |
| [package.json](../../../../open-water/package.json) | Dependencies: puppeteer-core for development only; ESM and scripts |
| [main.js](../../../../open-water/src/main.js) | QUALITY, App.frame, resize, updateCamera, filmFrame, audio.update, and live loop |
| [gl.js](../../../../open-water/src/gl.js) | createGL, Program, Texture, Target, MSTarget, emptyVao, makeMesh |
| [ocean.js](../../../../open-water/src/ocean/ocean.js) | CASCADES, SPECTRUM_FS, EVOLVE_FS, FFT_FS, ASSEMBLE_FS, computeStats |
| [water.js](../../../../open-water/src/ocean/water.js) | Polar mesh, displacement, slope moments, reflections, and foam |
| [probe.js](../../../../open-water/src/ocean/probe.js) | OceanProbe.run, PBO/fence, sync/async modes |
| [atmosphere.js](../../../../open-water/src/sky/atmosphere.js) | Atmosphere.update, LUTs, and atmospheric compositing |
| [clouds.js](../../../../open-water/src/sky/clouds.js) | 3D noise, marchClouds, SCREEN_FS, ENV_FS, resize, render |
| [sky.js](../../../../open-water/src/sky/sky.js) | Cloud compositing, environment, irradiance, and mipmaps |
| [post.js](../../../../open-water/src/fx/post.js) | Bloom pyramid, adaptation, custom transform, and resize |
| [rain.js](../../../../open-water/src/fx/rain.js) / [spray.js](../../../../open-water/src/fx/spray.js) | Seeds, instancing, counts, and blending |
| [lightning.js](../../../../open-water/src/fx/lightning.js) | Seeds, fractal channel, lighting, and events |
| [weather.js](../../../../open-water/src/weather.js) / [film.js](../../../../open-water/src/film.js) | Presets, smoothing, acts, events, and fades |
| [audio.js](../../../../open-water/src/audio/audio.js) / [ui.js](../../../../open-water/src/ui.js) | Live/offline Web Audio, gestures, controls, and intervals |
| [profiler.js](../../../../open-water/src/profiler.js) / [perf.mjs](../../../../open-water/tools/perf.mjs) | GPU queries and measurement limitations |
| [render.mjs](../../../../open-water/render/render.mjs) / [browser.mjs](../../../../open-water/tools/browser.mjs) | Export, recovery, ffmpeg, and browser flags |
| [README](../../../../open-water/README.md) | Intent, scientific bibliography, and author-reported results |

The copy has no Git metadata at this root. SHA-256 values for key files inspected:

```text
src/main.js       a67bbc5cfe056458c57c08a7bc203d784292ad523cce1f814e46757e3111d05d
src/gl.js         fd95841bc5f8dfd1831dd817d6aecf6c578b38c476d3ba28cce3582ad2f6e8c5
src/sky/clouds.js d291e7ab756ec00df2b80408a1055fe9a0f7cdcf090a40b02d9ed403d724de58
package-lock.json e97c2d92711523dc1824db36d3e0af40cd113b6fd25c893715bfa14d92cff805
```

## Tests Run for This Extraction

Development dependencies were installed with `npm ci --ignore-scripts --no-audit --no-fund`. The local server was opened with headless Chrome/Puppeteer using default flags, without disabling watchdogs or GPU locks.

- Reported GPU: ANGLE / Intel UHD Graphics / Direct3D11. Framebuffer: 640×360, DPR 1; `rt` quality, `r11g11b10f` HDR, 4x MSAA.
- Calm, storm, and night: 20 fixed steps of 1/30 s per scenario, preset change with snap, and cloud history reset. All three produced non-black pixels, `gl.getError() === 0`, no context loss, and no JS errors during those passes. Calm and storm screenshots were visually inspected.
- Each scenario evolved for only 0.67 s; exposure and foam may not have reached equilibrium. Do not use these images to judge final fidelity or these tests as an FPS benchmark or physical certification.
- `q=unknown`: startup failed while reading `fft` from undefined quality.
- `preset=unknown`: an instance was created, but all 25 `Weather.state` keys became non-finite after update.
- `app.resize(8,8)` followed by a frame: failed while reading `tex` from a missing bloom level.
- `q=high`: startup succeeded; canvas and clouds were both 640×360, confirming full resolution.

Local session data and captures: [.atl/open-water-check.json](../../../../.atl/open-water-check.json), [calm](../../../../.atl/open-water-calm.png), [storm](../../../../.atl/open-water-storm.png), [night](../../../../.atl/open-water-night.png). These are auxiliary evidence ignored by Git, not skill requirements; the summary above preserves the conclusions if only the skill is distributed.

No oceanographic calibration, full video export, audio tests, context-recovery tests, or mobile/multi-browser matrix was run. Other audit findings come from static inspection, with tests proposed for future implementations.

## Official Documentation Consulted

These sources support library recommendations; they do not prove that Open Water uses those libraries. Revalidate APIs against the installed version during implementation.

- [Three.js: Color Management](https://threejs.org/manual/pages/color-management.html): linear lighting, color/data inputs, and output transform.
- [Three.js: WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer): alternate WebGL2 backend, TSL, and compatibility limits for GLSL materials and traditional post-processing.
- [Three.js: GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html): glTF models and decoder configuration based on asset extensions.
- [Three.js: KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html): Basis transcoding, WASM, and support detection before loading.
- [Three.js: PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html): roughness-prefiltered environment and ownership of returned targets.
- [Three.js: EffectComposer](https://threejs.org/docs/pages/EffectComposer.html): post-processing chain for WebGLRenderer.
- [React Three Fiber: scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance): on-demand rendering, invalidation, reuse, instancing, LOD, and adaptive quality.
- [GSAP: Timeline](https://gsap.com/docs/v3/GSAP/Timeline/): time coordination, pause, and progress control.
- [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) and [clientWaitSync](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/clientWaitSync): capabilities, resource management, asynchronous readback, and wait results.

Tessendorf, Elfouhaily, Bruneton, Hillaire, and other works are identified in the original README. This document describes how the code applies or approximates those ideas; it does not claim to reproduce their scientific results or to have reviewed every original paper.

## Licenses

Open Water declares MIT code, copyright 2026 Leonxlnx: [LICENSE](../../../../open-water/LICENSE). If substantial code is copied, retain the notice and license. This extraction contains original instructions and analysis; it does not distribute its shaders or assets.

Audio has separate CC BY and CC BY-SA licenses: [CREDITS](../../../../open-water/assets/audio/CREDITS.md). Do not treat those files as MIT or include them in a template automatically. Any photographic or historical references added to pyramids should record their own provenance.
