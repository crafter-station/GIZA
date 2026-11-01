# assets-src

Heavy sources used to build the runtime assets in `static/`. They are never served. Binary files are stored with Git LFS (see `.gitattributes`); run `git lfs install` once after cloning.

| Folder                        | Content                                                            | Built by                                 |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| `dem/`                        | Copernicus GLO-30 crop of the Giza Plateau and a hillshade preview | `node tools/build-terrain.ts <tile.tif>` |
| `models/`                     | Source 3D models with their license notes                          | `tools/optimize-models` (Phase 7)        |
| `photos/`                     | Licensed reference and content photos                              | `tools/build-images.ts` (Phase 9)        |
| `illustrations/`, `textures/` | Generated illustrations and macro textures (see plan §11)          | `tools/build-images.ts`                  |

Third-party files need their author, license, and source recorded in the README of their folder.
