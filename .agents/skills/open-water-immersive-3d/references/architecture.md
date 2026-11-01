# Architecture Extracted from Open Water

## What the Project Actually Builds

The local project uses custom JavaScript ESM, WebGL2, and GLSL ES 3.00. It has no runtime dependencies in `package.json`; `puppeteer-core` is a development and capture tool. It does not use Three.js, React, GSAP, glTF, or a general-purpose physics engine. Its 3D appearance comes from procedural geometry, GPU-computed data textures, lighting, and compositing. "No textures" in its README means no downloaded image textures: it still creates many 2D and 3D GPU textures.

Inspected code is more authoritative than comments: the `ocean.js` header summarizes JONSWAP, but the implemented wind spectrum is Elfouhaily, with a separate swell component. In `main.js`, a comment mentions cloud thirds, while `rt.cloudDiv` is 2.

## Actual Frame Order

```text
Weather.target -> temporal smoothing -> Weather.state
  -> spectrum when changed -> FFT evolution -> displacement/slopes/foam
  -> reduced surface readback -> camera -> matrices
  -> atmospheric LUTs
  -> cloud shadows + cloud environment + screen-space/history clouds
  -> sky/cloud environment and irradiance map
  -> HDR framebuffer: sky -> water -> lightning -> spray -> rain
  -> MSAA resolve -> bloom + luminance measurement -> adaptation -> composition
  -> canvas output; overlay HTML and audio events
```

The irradiance consumed by the clouds is updated after them: it depends on the previous frame. This is a deliberate/implicit temporal approximation in the ordering, not a fully acyclic graph of current-frame data. When the environment changes radically, initialize and reset these resources as well.

## Responsibilities and Contracts

| Module | Input/output and reusable decision |
| --- | --- |
| `gl.js` | Programs with reflected uniforms, textures, FBO/MRT, MSAA targets, fullscreen triangle, and VAO. Keep resource ownership explicit. |
| `weather.js` | Presets, current/target state, and derived parameters. User input changes the target; systems read the coherent state. |
| `ocean/*` | Field computation, shading, and readback are separate. Decouple simulation, rendering, and CPU queries. |
| `sky/atmosphere.js` | Precomputed tables shared by multiple materials. Amortize expensive integrals. |
| `sky/clouds.js` | Rendering at different resolutions, temporal history, shadows, and environment. Do not repeat the full pass for every consumer. |
| `fx/*` | Specialized effects with early-outs when they add no value. Avoid JavaScript objects per particle. |
| `film.js` | Timeline data and sampling functions; `main.js` applies that data. Separate art direction from integration/rendering. |
| `audio/audio.js` | Web Audio graph deriving amplitude/filters from ambience. Offline mode reuses the engine. |
| `ui.js` | DOM controls; do not draw interface text inside the HDR render. |

## Time, Camera, and Narrative

The smoothing formula is `a = 1 - exp(-k * dt)`; updating `value += (target - value) * a` keeps the time constant approximately independent of FPS. Do not use a fixed per-frame `lerp(..., 0.1)` for the same transitions. For orientations, use quaternions/slerp or shortest-arc angular interpolation: the original's scalar azimuth lerp can make unnecessary full turns across 0/360°.

The floating camera queries height and slope filtered at roughly hull scale (~8 m), then smooths elevation, pitch, and roll. Transferable principle: the camera responds to a scale that matters to the observer. For walking through a pyramid, keep the horizon stable and collide with terrain; do not transfer a ship's roll.

`film.js` has three acts with camera, weather, events, and fades. It is useful to express chapters as data and support `sample(t)`, pause, and seeking. A history-based render (foam, exposure, clouds) is not deterministic just because `time = t` is assigned: it needs a seed, initial state, and identical step sequence. To seek backward, restore a checkpoint or rebuild from a defined state. For events, use intervals `(previousTime, time]` and an explicit seek policy.

## Adapting the Structure

For a new application, it is enough to separate `experience state`, `scene`, `camera`, `environment`, `quality`, `audio`, and `content`. Do not copy every Open Water class. One update function coordinates the timeline, interaction, and rendering; one system owns each animated property. If GSAP moves the camera, suspend/reconcile OrbitControls during that segment to avoid two writers.

Implementation sources: [main.js](../../../../open-water/src/main.js), [gl.js](../../../../open-water/src/gl.js), [weather.js](../../../../open-water/src/weather.js), [film.js](../../../../open-water/src/film.js).
