# Applying the Knowledge to Pyramids

## Choosing the Stack

Design recommendation, not a dependency found in Open Water: start with **Three.js + WebGLRenderer**, modules/TypeScript if the project adopts them, and DOM for content. This supports models, materials, cameras, and selection without maintaining the entire WebGL toolkit. Base the decision on the actual installed stack; check the official documentation for that version before copying an API. Do not pin a version number here that will become stale.

| Need | Reasoned choice |
| --- | --- |
| Models, PBR materials, raycasting, LOD, and instancing | Three.js; use GLB/glTF for monuments and interiors, procedural geometry for terrain and repeated variants |
| Existing React interface | `@react-three/fiber`; use Drei for specific helpers. Do not introduce React just to draw three objects |
| Narrative timeline with chapters, pause, and scrubbing | GSAP is optional; a few transitions can use pure functions and a shared clock. Use AnimationMixer for model clips, not a second system fighting over the same transform |
| Textures with high GPU memory cost | KTX2/Basis with KTX2Loader; call `detectSupport(renderer)` and provide a compatible transcoder before loading |
| Compressed geometry | GLTFLoader and MeshoptDecoder or DRACOLoader, depending on the asset extension; measure download and decoding. Do not install both by habit |
| WebGL post-processing | Small EffectComposer chain with output configured once; use bloom/AO only if a comparison demonstrates their value |
| Advanced WebGPU shaders | Consider WebGPURenderer + node materials/TSL if its effects, devices, and fallback are tested; do not assume it will be faster |
| Capture/regression | Puppeteer or Playwright as a development tool; do not include them in the client bundle |
| Ambient sound | Native Web Audio; loops and filters tied to wind, distance, and chapter. Start sound after interaction and do not hide essential explanations |

WebGPURenderer may fall back to a WebGL2 backend, but **that does not make ShaderMaterial/RawShaderMaterial, `onBeforeCompile`, or traditional EffectComposer compatible**. If choosing that route, implement effects in its compatible system and test both backends. Also do not share context between the original's raw toolkit and Three.js without explicit ownership of state and synchronization; avoid that integration unless there is a demonstrated need.

R3F is an organizational alternative. Per-frame updates should use refs and `useFrame`, not setState per particle. `frameloop="demand"` suits an idle scene; continuous animation, wind, or a timeline needs invalidations/frames while active. Share geometries/materials and define who releases cached assets. These guidelines are based on R3F performance documentation [recorded here](sources.md).

## An Educational Journey That Justifies 3D

These are ideas for later design, not features implemented by this skill:

| Moment | Educational question | Derived technique | Lower-cost alternative |
| --- | --- | --- | --- |
| Dawn reveal | How does light and perspective change the perception of scale? | Dominant silhouette, aerial perspective, and slow camera transition | Simple sky + fog and a fixed camera |
| Approach to a wall | What can be seen at block scale compared with the whole monument? | Near geometry -> normals -> distance-based roughness | Wall LOD and a normal map |
| Compare reconstruction and current state | What is preserved and what is being reconstructed? | Scene/material states, slider with evidence labels | Two equivalent static views |
| Interior cutaway | How are chambers and passages spatially connected? | Separate model/clipping, constrained camera, and occlusion-aware hotspots | Accessible HTML/SVG diagram |
| Explore sun/shadow | What changes when the sun's direction and elevation vary? | Shared environmental state and controlled shadows | Preset positions; do not call them real dates without a verified astronomical model |
| Night | How do we perceive the complex under different lighting? | Bounded exposure and subtle ambience | Static preset and text; no swaying or flashes |

Do not make scrolling the only navigation method. Offer next, previous, pause, and explore controls; for users who choose reduced motion, provide stable framing and simple transitions. Every 3D hotspot must have an equivalent button in a DOM list and content that can be read without rendering.

## Modeling, Scale, and Materials

Define world units (preferably meters), up axis, north, and origin. Verify scale, normals, UVs, pivots, and bounds on import. Associate every historical geometry with a source and confidence level; a parametric procedural pyramid is a prototype until checked against data. Do not invent dimensions or internal chambers.

For masonry, instance blocks near the camera or in a construction sequence; group by material and spatial region for culling. At a distance, use simplified meshes/normal maps; representing every block as an independent object can destroy the CPU budget. Preserve silhouette and important edges during simplification. Interior assets can load when the relevant chapter begins.

For sand, use low-frequency albedo/roughness variation and filtered normals; control repetition at large scales. Do not exaggerate subpixel displacement or use metallic materials to create shine. For limestone, create perceptual variation through roughness, color, and lighting; start with a standard material and tune it against references rather than adding uniform noise everywhere.

## Lighting and Atmosphere

Use a key directional light and a coherent ambient contribution. In panoramic views, limit shadow distance and resolution; in close-ups, fit the frustum to the visible area or consider cascades if needed. Avoid dynamic shadows for every block if a bake or aggregated representation preserves the result. Test acne, shadow bias, and stability as the camera moves.

Distant dust is usually handled with fog and a few layers/particles. Raymarched volumes are an optional tier, not a requirement for a compelling result. Scale also comes from shadows, reference objects, and camera parallax. Reserve bloom for bright sources and prevent it from erasing relief or information.

## Implementation Order

First build one complete, small chapter: a pyramid with verifiable scale, lighting/sky, one controllable transition, and one hotspot that teaches something. Measure loading and navigation on the reference device. Add final models/materials, interiors, dust, sound, and post-processing incrementally, comparing visuals and cost per effect. The goal is an understandable, responsive experience; technical complexity must demonstrate its value.
