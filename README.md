# Giza

An educational 3D journey through the pyramids of Giza. A cinematic, scroll-driven tour of Khufu, Khafre, and Menkaure, built around one interaction: **deconstruction**. A pyramid separates into the blocks that form it; they stay suspended in the air, and you can explore, inspect, rearrange, and reassemble them.

> Status: Phase 0 (foundations and data) complete. See [plan.md](plan.md) for the roadmap (in Spanish).

## Stack

- SvelteKit 3 + Svelte 5, prerendered as a static site (`adapter-static`)
- three.js `WebGPURenderer` with TSL shaders and automatic WebGL2 fallback
- GSAP and Lenis for choreography and scrolling, Rapier (WASM) for physics, `suncalc` for the real sun at Giza
- Tailwind CSS 4 for the UI layer
- Biome, Vitest, Playwright, and agent-browser for quality

## Getting started

Requirements: Node 24+, pnpm 11, Git LFS.

```sh
git lfs install
pnpm install
pnpm dev
```

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm preview` | Static build in `build/` and local preview |
| `pnpm check` | Type-check |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm test` | Unit and component tests |
| `pnpm test:e2e` | End-to-end tests (run `pnpm exec playwright install` once) |
| `pnpm build:terrain <tile.tif>` | Rebuild the heightmap from the Copernicus DEM |

## Project layout

```
src/lib/data/      verified figures, geographic frame, heightmap contract
src/lib/content/   bibliography and fact registry
src/routes/        SvelteKit pages
static/terrain/    runtime heightmap
tools/             offline content builders (run with Node)
assets-src/        heavy sources with license notes (Git LFS)
tests/e2e/         Playwright tests
```

## Credits and data

- Terrain: Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
- Placeholder sphinx model: "Egyptian-style sphinx statue" by Sofia Nasopoulou, CC BY 4.0 (see `assets-src/models/sphinx-marathon/README.md`).
- Historical figures and their sources: `src/lib/content/sources.ts`.
