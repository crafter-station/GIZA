# GPU Techniques: Mechanism, Benefits, and Limits

## 1. Multiscale Fields Instead of Millions of Objects

`ocean/ocean.js` divides frequencies into four cascades with extents of 1800, 117, 21, and 3.7 meters. For each, it generates seeded Gaussian noise, a complex spectrum, and temporal evolution with dispersion; it then runs a horizontal and vertical inverse Stockham radix-2 FFT. Sizes are powers of two. It packs pairs of real fields as complex signals and uses MRT to produce multiple outputs per pass.

The `RGBA32F` FFT buffers use nearest filtering and are shared between cascades with the same resolution. The spatial result, slopes, and foam use more compact formats and mipmaps. Reads go from A and writes to B; swap them afterward. Never sample a texture that is attached as the destination of the same pass.

The geometry uses the three largest cascades; the fragment shader incorporates slopes from all four. The camera-centered polar mesh increases ring spacing with distance. Filter displacement according to vertex spacing: a large triangle should not try to represent a tiny oscillation.

**Transfer to the desert:** use terrain/dunes for large silhouettes, normals for visible undulations, and roughness for subpixel grains. Use LOD or tiles/clipmaps for terrain; keep monument positions in world space. Do not displace pyramids with a camera-centered mesh or run water FFTs for static sand. Procedural does not mean computing everything every frame: precompute and reuse noise maps.

## 2. Preserve Detail Across Scales

The water stores moments `E[sx], E[sz], E[sx²], E[sz²]`. During filtering, `variance = max(E[s²] - E[s]², 0)` converts unresolved slope into specular-lobe width. The shader adds normal variation from derivatives and limits total variance to avoid artificially broad reflections. This is an approximate LEAN formulation without all terms of a general distribution.

Reusable idea: detail does not disappear abruptly; it changes representation. For stone and sand, try mipmaps and standard PBR materials first; a custom BRDF is justified when you can measure a problem they do not solve. Do not transplant Fresnel, Cox–Munk, or aquatic-scattering constants to limestone. Do not force water-like sparkle across all sand.

## 3. Persistent State, Advection, and Filters

Foam forms when the displacement Jacobian indicates compression/breaking. There is an active-breaking channel (~0.4 s) and residual foam, with production proportional to `dt` and decay `exp(-decay * dt)`. Residual history is advected by wind using Catmull–Rom resampling to reduce diffusion; the result is clamped because this filter can overshoot. A procedural bubble pattern turns density into visible coverage.

For dust or trails, reuse density fields, advection, and different lifetimes; define their own units and causes. The water-breaking criterion does not describe erosion or sand transport.

## 4. Table-Based Atmosphere and Consistent Lighting

`atmosphere.js` creates transmittance LUTs at 256×64, multiple-scattering LUTs at 32×32, sky-view LUTs at 256×128, and aerial-perspective LUTs at 64×64. The first two are recomputed when the haze key changes; the others are updated every frame. This aerial perspective is a 2D approximation, not a complete volume for all positions and heights.

Reuse the compositing equation `Lfinal = Lsurface * T + Linscatter`. Sky, objects, and particles must share the same sun, fog, scale, and exposure. Do not fix incorrect fog by changing only object colors. The original uses sea-aerosol coefficients: mineral dust needs its own parameters or a declared artistic approximation. Start with simple sky and fog; adopt custom LUTs if the views and transitions require them.

The original environment is equirectangular with conventional mipmaps and a water-reflection-specific approximation. A normal mipmap is not equivalent to BRDF convolution. For standard Three.js materials, use its prefiltered environment/PMREM and avoid counting the sun twice between direct light and environment.

## 5. Volumes That Do Not Block the Entire GPU

Clouds precompute 128³ Perlin–Worley and 32³ Worley noise in `RGBA8`, plus a 512² weather map. The raymarch skips empty space, steps back when it encounters density, increases step size with distance, and exits when transmittance drops. Lighting uses secondary marches, Beer–Lambert, and multiple-scattering approximations.

In `rt`, screen-space clouds render at half width and height. The checkerboard normally updates one in four pixels of the buffer and reprojects the rest: roughly 1/16 of the new samples of a full-resolution render, excluding resets and other passes. This does not guarantee a corresponding reduction in total cost. The 256² shadow and 320×160 cloud environment alternate updates except during events.

Keep distance and transmittance alongside radiance to composite fog in front of clouds correctly. Here `alpha` means **transmittance**, not opacity. Use `Lcloud + Tcloud * Lbehind`; do not mix this convention with premultiplied particles without conversion.

Temporal accumulation saves work but requires reprojection, history rejection, and resets. The original compensates for wind in the non-checkerboard path; in `rt` it uses approximate directional reprojection, not full disocclusion rejection. For dust near monuments, add depth/validity checks and a history limit; first test without history to isolate errors. Reset on camera, FOV, resolution, lighting, and scene changes. Do not hide ghosting by increasing blur.

## 6. GPU Particles and Compositing

Rain and spray use static seeds, instanced quads, and vertex-shader evolution. The CPU updates a few uniforms, not each drop. Rain reserves 120,000 drops and 40,000 splashes; spray uses 12,000 instances. These are figures from the original, **not** recommendations for `pyramids`.

In the original, changing density updates uniforms, but the draw still submits the total number of instances. For low quality levels, also reduce the instance count if the distribution allows. For dust, pay particular attention to overdraw from transparent quads: few draw calls do not imply low cost. Keep depth testing, normally disable depth writes for translucent particles, and define ordering/blending. Indoors, use scene depth to avoid hard intersections or dust passing through walls.

## 7. HDR and Output

The original renders HDR with MSAA, resolves to the same format, then computes bloom in a pyramid, log luminance, 1×1 adaptation, and a custom transform based on AgX. It includes NaN/Infinity guards to prevent one pixel from contaminating the entire history. These defenses do not replace fixing the calculation that produced the invalid value.

For a new implementation: correctly tag color textures as sRGB, leave data (normal, roughness, masks) unconverted, use linear lighting, and apply one tone-mapping/output conversion. Do not copy its custom AgX curve as a canonical implementation or add gamma on top without checking the contract. Check grayscale charts, saturation, and HDR sources. Apply post-processing to the world; keep educational text legible in the DOM.

Sources: [ocean.js](../../../../open-water/src/ocean/ocean.js), [water.js](../../../../open-water/src/ocean/water.js), [clouds.js](../../../../open-water/src/sky/clouds.js), [atmosphere.js](../../../../open-water/src/sky/atmosphere.js), [post.js](../../../../open-water/src/fx/post.js).
