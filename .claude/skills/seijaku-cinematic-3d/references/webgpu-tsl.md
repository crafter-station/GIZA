# WebGPU/TSL Route

`pyramids` renders with `WebGPURenderer` (`three/webgpu`) and writes every shader in TSL (`three/tsl`). The renderer falls back to WebGL2 automatically with the same TSL code. The techniques in this skill were extracted from a WebGL project; apply them through these equivalents.

Pinned version: `three@0.187.0`. Update three only at the start of a phase, with `?t=` regression captures before and after.

## Equivalents

| In this skill (WebGL) | In pyramids (WebGPU/TSL) |
| --- | --- |
| `onBeforeCompile` + chunk replacement (`inject`/`after`) | `MeshStandardNodeMaterial` / `MeshPhysicalNodeMaterial` with `colorNode`, `normalNode`, `roughnessNode`, `positionNode`, `emissiveNode`, `opacityNode` |
| `ShaderMaterial` / `RawShaderMaterial` | `NodeMaterial` with `vertexNode` / `fragmentNode`, or a TSL `Fn` |
| Shared `{ value }` uniforms | One `uniform()` node imported by every material that needs it; update `.value` |
| `customProgramCacheKey` | Not needed: the node graph is the cache key. Avoid creating new nodes per frame |
| pmndrs `postprocessing` + N8AO | `RenderPipeline` (named `PostProcessing` in older releases) with `pass(scene, camera)`, `ao()`, `bloom()`, `traa()` and custom TSL grading |
| `OutputPass` / manual sRGB | The pipeline applies tone mapping and the output color space once (`renderOutput()`); keep the scene linear |
| Particles with closed-form motion in the vertex shader | Same idea with `positionNode` and `instanceIndex`; with state, `instancedArray()` + `compute()` |
| GPGPU ping-pong render targets | Storage buffers (`instancedArray`) and compute kernels dispatched with `renderer.compute()` |
| Custom god-rays pass | `godrays()` node (`three/addons/tsl/display/GodraysNode.js`) inside the pipeline, at reduced resolution |
| Cascaded shadows by hand | `CSMShadowNode` (`three/addons/csm/CSMShadowNode.js`) |
| `Sky` addon | `SkyMesh` (`three/addons/objects/SkyMesh.js`) |
| `renderer.compileAsync(scene, camera)` | Same API; call `await renderer.init()` first |
| `renderer.initTexture(t)` | `renderer.initTexture(t)` (also available) |
| Own `requestAnimationFrame` | `renderer.setAnimationLoop(loop)` as the single clock; it also drives GSAP (`gsap.updateRoot`) and Lenis |
| `webglcontextlost` | `renderer.onDeviceLost` (WebGPU) plus the WebGL2 context-loss event in the fallback |
| `fract(sin(x) * 43758.5453)` hash | Integer or sine-free hash written in TSL (`hash()` from `three/tsl` or a Hoskins-style `Fn`) |
| `smoothstep(edge0 > edge1, …)` | Same rule: never inverted edges; use `oneMinus(smoothstep(a, b, x))` |

## Rules Specific to WebGPU

1. Choose the backend before writing a shader. Never mix `ShaderMaterial` into a `WebGPURenderer` scene.
2. Build node graphs once, at material creation. Changing the graph recompiles the pipeline; change uniforms instead.
3. Compute dispatch sizes and buffer layouts are fixed at creation: allocate for the highest instance count of the current quality tier.
4. Reading GPU data back (`renderer.getArrayBufferAsync`, picking) is asynchronous: never block the frame waiting for it.
5. The WebGL2 fallback runs compute through transform feedback and is slower: lower the quality tier automatically when `renderer.backend.isWebGPUBackend` is false.
6. Test both backends: `?backend=webgl` forces the fallback.

## `suncalc` v2

`suncalc@2` changed its units: `getPosition` returns **degrees**, and azimuth is measured **clockwise from north** (0 = N, 90 = E). Version 1 returned radians with azimuth from south. Convert explicitly when building the sun direction:

```ts
const { altitude, azimuth } = SunCalc.getPosition(date, lat, lon); // degrees
const alt = altitude * DEG, az = azimuth * DEG;
// local frame: +x = east, -z = north, +y = up
sunDirection.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
```
