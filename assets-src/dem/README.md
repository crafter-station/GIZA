# Giza DEM

## Source

- Product: Copernicus DEM GLO-30, DGED distribution (2021_1), a **digital surface model**: the pyramids, the modern city, and vegetation are part of the heights.
- Tile: `Copernicus_DSM_10_N29_00_E031_00` (29–30° N, 31–32° E), 1 arcsecond grid (≈ 27 × 31 m at Giza), pixel-is-point.
- Datums: horizontal WGS84 (G1150), vertical EGM2008 geoid.
- Downloaded from the Copernicus Browser (https://browser.dataspace.copernicus.eu/, dataset `DEM_COPERNICUS_30_CDAS`).
- Attribution (required wherever the terrain is shown): _Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved._

The original 52 MB tile is not committed. To rebuild:

```sh
node tools/build-terrain.ts path/to/Copernicus_DSM_10_N29_00_E031_00/DEM/Copernicus_DSM_10_N29_00_E031_00_DEM.tif
```

## Files

| File                            | Content                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `giza-cop30-crop.f32` + `.json` | Native-resolution crop (Float32, geographic grid) covering the runtime square |
| `giza-height-preview.png`       | Hillshade of the runtime heightmap                                            |

## Known limits

- Khufu stands 2.3 km south of the tile's north edge, so the runtime square is shifted south (`center.z = 1920`). Extending it north needs tile `N30 E031`.
- The DSM smooths a 146 m pyramid into a ≈ 35–40 m bump and shifts tall objects slightly (radar). The terrain system must flatten the footprints of the monuments and rebuild them procedurally.
- Peak check against the reference coordinates (in `static/terrain/giza-height.json` → `verification`): Khufu 54 m, Khafre 31 m, Menkaure 0 m. These offsets are within the DSM's noise for tall structures; the Sphinx sits in a hollow and cannot be checked this way.
