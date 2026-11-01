---
name: open-water-immersive-3d
description: "Trigger: immersive 3D experiences, atmospheric rendering, Open Water. Apply GPU, animation, and performance techniques to educational web scenes."
license: MIT
metadata:
  author: "pyramids"
  version: "1.0"
---

## Activation Contract

Use this skill when designing, implementing, or reviewing atmospheric 3D web experiences with a narrative camera and adaptive quality, especially `pyramids`. Extract principles from Open Water; do not reproduce its ocean or impose simulations unrelated to the subject. Do not load it for an isolated CSS animation.

## Hard Rules

- Distinguish observed implementation, proposed improvements, and measured behavior. Do not present README figures or suggested budgets as your own results.
- Use one render owner, one clock, and shared environmental state. Keep educational content, scene, and quality separate.
- Choose the backend before shaders and post-processing; Open Water's GLSL is not interchangeable with WebGPURenderer.
- Keep lighting in linear space and apply a single final output transform. Declare the format, units, and meaning of every buffer channel.
- Validate parameters and capabilities; provide useful HTML content if 3D fails. Manage resources, context loss, reduced motion, and pause behavior.
- Measure before increasing complexity. Preserve readability, responsive controls, and silhouettes when reducing quality.

## Decision Gates

| Need | Reference to read |
| --- | --- |
| Understand or reorganize the engine | [Architecture](references/architecture.md) |
| Materials, atmosphere, particles, or shaders | [GPU techniques](references/gpu-techniques.md) |
| Responsiveness, memory, loading, or validation | [Performance](references/performance.md) |
| Reuse code or diagnose failures | [Audit and corrections](references/audit.md) |
| Choose libraries or adapt to Egypt | [Applying this to pyramids](references/pyramids.md) |

## WebGPU/TSL Route (pyramids)

Open Water is WebGL2 with hand-written GLSL; `pyramids` renders with `WebGPURenderer` (`three@0.187.0`) and TSL, with automatic WebGL2 fallback. Port techniques, not shader strings:

| Open Water (WebGL2/GLSL) | pyramids (WebGPU/TSL) |
| --- | --- |
| GLSL `ShaderMaterial` / raw programs | Node materials (`MeshStandardNodeMaterial`, `colorNode`, `normalNode`, `positionNode`) or TSL `Fn` |
| Ping-pong render targets for simulation | Storage buffers (`instancedArray`) + `compute()` kernels |
| Hand-rolled post chain and output transform | `RenderPipeline` with `pass()`, `ao()`, `bloom()`, `traa()`, `godrays()`; one `renderOutput()` |
| Own sky shader | `SkyMesh` (WebGPU addon) or a TSL atmosphere driven by the `suncalc` sun |
| Own shadow setup | `CSMShadowNode` for cascaded sun shadows |
| `requestAnimationFrame` | `renderer.setAnimationLoop()` as the single clock |

The full equivalence table and WebGPU rules live in [seijaku-cinematic-3d/references/webgpu-tsl.md](../seijaku-cinematic-3d/references/webgpu-tsl.md).

## Execution Steps

1. Inspect the stack and installed versions, target devices, and scene purpose. Read only the references you need.
2. Choose an educational interaction and define its state, coordinates, camera, GPU passes, and observable success criteria.
3. Implement silhouette, scale, lighting, and controls first. Add distance detail, sound, and effects only when they support the interaction.
4. Apply relevant audit corrections; treat budgets as measurable hypotheses and configure quality degradation by cost.
5. Verify cold loading, navigation, transitions, resizing, pause, fallback, and the most expensive scene. Record the device, effective resolution, backend, and test limitations.

## Output Contract

Deliver the requested changes or design, justified technical decisions, checks actually performed, and outstanding limitations. Identify historical sources and hypothetical reconstructions when educational content is involved. Do not publish or generate a site merely because this skill was activated.

## References

- [Sources and provenance](references/sources.md): code paths, official documentation, and evidence scope.
- The five references in the table contain reusable knowledge; the original repository is for further study, not a runtime dependency.
