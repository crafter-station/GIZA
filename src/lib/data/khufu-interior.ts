import { fact } from '../content/sources.ts';
import { INCH } from './khufu-courses.ts';

export interface InteriorPoint {
	north: number;
	east: number;
	up: number;
}

const point = (north: number, east: number, up: number): InteriorPoint => ({ north, east, up });

export const PETRIE_INTERIOR = fact(
	{
		entrance: point(4010.0, 287.0, 668.2),
		descendingEnd: point(306, 286.4, -1181),
		subterraneanPassageEnd: point(-40, 286.3, -1178),
		subterraneanChamber: { center: point(-203, 25.9, -1056), northSouth: 330, eastWest: 555, height: 157 },
		ascendingStart: point(3016.3, 286.6, 179.9),
		ascendingEnd: point(1626.8, 287, 852.6),
		galleryEnd: point(-61.7, 284.4, 1689.0),
		galleryWidth: { floor: 82.4, top: 41.2, laps: 7, height: 338.6 },
		queensChamber: { north: 102.0, south: -104.0, east: 308, west: 81.4, floor: 834.4, apex: 1078.7 },
		antechamber: { north: -113.7, south: -229.8, floor: 1692.6, roof: 1841.5, width: 65 },
		kingsChamber: { north: -330.6, south: -537.0, east: 305.1, west: -107.7, floor: 1692.5, ceiling: 1922.6 },
		passage: { width: 41.5, height: 47.3 }
	},
	{
		unit: 'in',
		status: 'established',
		sources: ['petrie1883', 'wikipediaGiza'],
		checked: 'primary',
		note: 'Petrie, “General summary of the positions inside the Great Pyramid” and §§ on the King’s Chamber and Gallery: north of the pyramid centre (negative = south), east of the centre, height above the pavement. The subterranean chamber size (8.4 × 14.1 × ≈ 4 m) comes from the Wikipedia summary of the published plans; the antechamber width is not in Petrie’s summary and is an estimate.'
	}
);

export const SCAN_PYRAMIDS = fact(
	{
		bigVoid: { minLength: 30, aboveGallery: 15, inclinedLikeGallery: true },
		northFaceCorridor: { length: 9, section: 2, aboveEntrance: 4 }
	},
	{
		unit: 'm',
		status: 'hypothesis',
		sources: ['morishima2017', 'procureur2023'],
		checked: 'secondary',
		note: 'Both spaces are detected, not entered. Published: the Big Void lies above the Grand Gallery, with a similar cross-section and at least 30 m long, inclination unknown; the corridor is about 9 m long with a 2 × 2 m section behind the entrance chevrons. Their exact offsets here are visual placements.'
	}
);

export function interiorToLocal(p: InteriorPoint): [number, number, number] {
	return [p.east * INCH, p.up * INCH, -p.north * INCH];
}
