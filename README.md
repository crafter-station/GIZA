<div align="center">
  <img width="45%" alt="Giza" src="static/images/pyramid-sign.webp" />

  <img src="https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white" alt="Svelte 5" /> <img src="https://img.shields.io/badge/SvelteKit-3-FF3E00?logo=svelte&logoColor=white" alt="SvelteKit 3" /> <img src="https://img.shields.io/badge/three.js-r187-000000?logo=three.js&logoColor=white" alt="three.js r187" /> <img src="https://img.shields.io/badge/WebGPU-TSL-005A9C" alt="WebGPU + TSL" /> <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6" /> <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white" alt="Tailwind v4" /> <img src="https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white" alt="pnpm 11" /> <img src="https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white" alt="Deploy on Vercel" />
</div>

<p align="center">An educational 3D tour of the pyramids of Giza — take Khufu apart, block by block.</p>

<p align="center"><a href="#quickstart"><strong>Run it locally</strong></a> · <a href="plan.md">Master plan</a> · <a href="AGENTS.md">Agent guide</a></p>

## Why Giza

Five reasons this is not another 3D slideshow:

- **One interaction, not a gallery.** The tour is built around **deconstruction**: the pyramid separates into the blocks that form it, they hang in the air, and you explore, inspect, drop and reassemble them. Everything else is the stage for that moment.
- **Real numbers, always labelled.** Heights, courses, volume and workforce come from `src/lib/data/*.ts` as `Fact` objects with a source, and every estimate or hypothesis is marked as such in the interface — the ramp question is presented as four labelled hypotheses, never as an answer.
- **The sun is the real sun.** `suncalc` puts the light where it belongs for the chosen date, which is what makes the no-shadow window at noon (28 February to 13 October for Khufu) a fact you can watch instead of read.
- **It runs on the GPU.** 140 000 instanced blocks at the top tier, moved by compute shaders in TSL, picked on the GPU instead of raycasting the CPU.
- **It degrades on purpose.** No WebGPU drops to WebGL2 with the same shader code, a 1.5 s benchmark during loading picks the quality tier, and `prefers-reduced-motion` replaces the flying blocks with a section cut.

## Features

| Area | What you get |
|---|---|
| 🏛️ Tour | Eleven scroll-driven chapters from sunrise on the plateau to the night sky of 2560 BCE, with arrow keys, chapter menu and deep links |
| 🧱 Deconstruction | 201 measured courses of Khufu, wave take-off, exploded view, floating drift and assembly from the bottom up |
| 🔬 Inspector | Pull a block out of the air: dimensions, volume, stone, quarry map and a 1.75 m figure for scale |
| ☀️ Sun and shadow | Date and time slider driving real sun position, cast shadows and the concave faces on the equinox |
| 🏗️ Construction | Twenty-year timeline weighed by course volume, 20 000–30 000 workers, four ramp hypotheses and Merer's diary |
| 🌙 Sky of 2560 BCE | 2 068 Bright Star Catalogue stars with proper motion and IAU 2006 precession, so Thuban sits near the pole |
| 🔍 X-ray and origins | Slice through the courses, open Khufu's chambers, and colour the stone by origin: local limestone, Tura, Aswan granite |
| ⚡ Collapse | Rapier in a Web Worker drops the upper courses; the rest keeps floating until you reassemble |
| 🔊 Soundscape | Wind, sand hiss, stone hum, the rumble before take-off and impacts on landing, all synthesized, off by default |
| ⚙️ Quality tiers | Four tiers chosen by a real benchmark, with adaptive pixel ratio and a hard cap on the WebGL2 fallback |

## Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 3 + Svelte 5 runes, prerendered to static HTML with `adapter-static` |
| Renderer | three.js `WebGPURenderer` with TSL, automatic WebGL2 fallback |
| Post-processing | Nodal pipeline: GTAO, god rays, bloom, TRAA, grading, AgX |
| Motion | GSAP timelines and Lenis scroll, both driven by the single render loop |
| Physics | Rapier (SIMD WASM) in a Web Worker, only for collapse |
| Sun and sky | `suncalc` for the light, `SkyMesh` atmosphere, real star catalogue |
| Terrain | Copernicus GLO-30 DEM processed offline, tiles with LOD and skirts |
| UI | Tailwind CSS 4 tokens with Bits UI primitives |
| Quality | Biome, svelte-check, Vitest, Playwright, agent-browser |

## Quickstart

Requirements: Node 24+, pnpm 11 and Git LFS.

```sh
git lfs install
pnpm install
pnpm dev # http://localhost:5173
```

The site is fully static: `pnpm build` writes `build/` and `pnpm preview` serves it.

> On Windows laptops with two GPUs, Chrome may still use the integrated one. The app is fine: the benchmark measures it and picks a lower tier. Force the discrete GPU in Windows graphics settings if you want the top tier.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm preview` | Static build and local preview |
| `pnpm check` | Svelte and TypeScript type-check |
| `pnpm lint` / `pnpm format` | Biome check and write |
| `pnpm test` | Unit tests in Node and component tests in the browser |
| `pnpm test:e2e` | Playwright end to end against the production build |
| `pnpm build:terrain <tile.tif>` | Rebuild the heightmap from the Copernicus DEM tile |
| `pnpm build:stars` | Rebuild the 2560 BCE star positions |

## Project layout

| Path | What lives there |
|---|---|
| `src/lib/engine/` | Renderer, loop, picking, quality, loading, post-processing |
| `src/lib/world/` | Terrain, sky, lighting, atmosphere, vegetation, era |
| `src/lib/monuments/` | Pyramids, blocks, interiors, complex, construction |
| `src/lib/materials/` | TSL nodes for limestone, Tura, granite, sand, masonry |
| `src/lib/data/` | Verified figures, geographic frame, courses, GIS footprints |
| `src/lib/content/` | Bibliography and the `Fact` registry |
| `src/lib/tour/` | Chapters, camera keyframes, drone |
| `src/lib/ui/` | Svelte components, engine-agnostic to three.js |
| `src/routes/` | Prerendered pages, SEO head, design tokens |
| `tools/` | Node scripts for terrain, stars and assets |
| `tests/e2e/` | Playwright: tour, deconstruction, palette, construction, SEO |

The engine is framework-free TypeScript. Svelte never touches a three.js object: it reads a typed store and emits intentions such as `deconstruct('khufu')`.

## Honesty by default

- Every visible figure is a `Fact` with source, state (`established`, `estimate`, `hypothesis`) and verification method.
- Reconstructions are labelled in the interface: the Tura casing, the temples, the ramps, the torchlight and the ancient Nile are interpretations, not records.
- The base world shows the monuments as they are today, on a simplified landscape without the modern city, and says so.
- The Sphinx is a scan of Bert W. Longworth's 1903 bronze model (The Watt Institution, CC BY 4.0). It is credited as a historical model, not as photogrammetry of the monument.
- Hieroglyphs are real Unicode signs from the Egyptian Hieroglyphs block, never AI-generated glyphs.

## Performance

Measured on an RTX 3050 laptop, Chrome, WebGPU, ultra tier, 140 000 blocks: median frame 16.7 ms (60 fps, vsync capped). The WebGL2 fallback is capped at the medium tier. Budgets for the remaining devices are in [plan.md](plan.md) section 8.