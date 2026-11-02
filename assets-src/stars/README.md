# Bright Star Catalogue

| File | Content |
| --- | --- |
| `bsc5.dat.gz` | The Bright Star Catalogue, 5th Revised Edition (9 110 objects, J2000 positions and proper motions) |
| `bsc5.readme` | Byte-by-byte description of the catalogue |

- **Authors**: Dorrit Hoffleit and Wayne H. Warren Jr. (Yale University Observatory; NASA Astronomical Data Center, 1991).
- **Source**: SAO Telescope Data Center mirror, <http://tdc-www.harvard.edu/catalogs/bsc5.html> (also CDS catalogue V/50).
- **License**: distributed freely by NASA ADC, CDS and the SAO for any use with citation of Hoffleit & Warren (1991).

`node tools/build-stars.ts` keeps the stars brighter than magnitude 5.2, moves them to 2560 BCE with their proper motions and the IAU 2006 (P03) precession of Capitaine, Wallace and Chapront (2003), and writes `src/lib/data/stars-ancient.ts`.
