import { toLocal } from './geo.ts';
import { KHAFRE, KHUFU, MENKAURE, QUEENS, SPHINX } from './pyramids.ts';

export interface PyramidVolume {
	id: string;
	x: number;
	z: number;
	baseX: number;
	baseZ: number;
	originalHeight: number;
	currentHeight: number;
}

export interface Footprint {
	x: number;
	z: number;
	halfX: number;
	halfZ: number;
}

export const PYRAMIDS: readonly PyramidVolume[] = [
	{
		id: 'khufu',
		...KHUFU.position,
		baseX: KHUFU.baseSide.value,
		baseZ: KHUFU.baseSide.value,
		originalHeight: KHUFU.originalHeight.value,
		currentHeight: KHUFU.currentHeight.value
	},
	{
		id: 'khafre',
		...KHAFRE.position,
		baseX: KHAFRE.baseSide.value,
		baseZ: KHAFRE.baseSide.value,
		originalHeight: KHAFRE.originalHeight.value,
		currentHeight: KHAFRE.currentHeight.value
	},
	{
		id: 'menkaure',
		...MENKAURE.position,
		baseX: MENKAURE.base.value.a,
		baseZ: MENKAURE.base.value.b,
		originalHeight: MENKAURE.originalHeight.value,
		currentHeight: MENKAURE.currentHeight.value
	}
];

const queenAt = (lat: number, lon: number) => toLocal({ lat, lon });
const g1b = queenAt(QUEENS.g1b.value.lat, QUEENS.g1b.value.lon);
const g3a = queenAt(QUEENS.g3a.value.lat, QUEENS.g3a.value.lon);
const g3b = queenAt(QUEENS.g3b.value.lat, QUEENS.g3b.value.lon);
const queen = (id: string, x: number, z: number, base: number, originalHeight: number, currentHeight: number) => ({
	id,
	x,
	z,
	baseX: base,
	baseZ: base,
	originalHeight,
	currentHeight
});

export const QUEEN_PYRAMIDS: readonly PyramidVolume[] = [
	queen(
		'g1a',
		g1b.x,
		g1b.z - QUEENS.g1b.value.base / 2 - 10 - QUEENS.g1a.value.base / 2,
		QUEENS.g1a.value.base,
		QUEENS.g1a.value.height,
		QUEENS.g1a.value.height * 0.7
	),
	queen('g1b', g1b.x, g1b.z, QUEENS.g1b.value.base, QUEENS.g1b.value.height, QUEENS.g1b.value.height * 0.7),
	queen(
		'g1c',
		...(Object.values(queenAt(QUEENS.g1c.value.lat, QUEENS.g1c.value.lon)) as [number, number]),
		QUEENS.g1c.value.base,
		QUEENS.g1c.value.height,
		QUEENS.g1c.value.height * 0.75
	),
	queen('g3a', g3a.x, g3a.z, QUEENS.g3a.value.base, QUEENS.g3a.value.height, QUEENS.g3a.value.current),
	queen('g3b', g3b.x, g3b.z, QUEENS.g3b.value.base, QUEENS.g3b.value.base * 0.65, QUEENS.g3b.value.base * 0.6),
	queen(
		'g3c',
		g3b.x - (g3a.x - g3b.x),
		g3b.z,
		QUEENS.g3b.value.base,
		QUEENS.g3b.value.base * 0.65,
		QUEENS.g3b.value.base * 0.55
	)
];

export const ALL_PYRAMIDS: readonly PyramidVolume[] = [...PYRAMIDS, ...QUEEN_PYRAMIDS];

export const SPHINX_PLACEMENT = {
	...SPHINX.position,
	length: SPHINX.size.value.length,
	height: SPHINX.size.value.height,
	width: SPHINX.size.value.width
};

export const PLATFORM_MARGIN = 25;

export const FLATTENED_FOOTPRINTS: readonly Footprint[] = ALL_PYRAMIDS.map((pyramid) => ({
	x: pyramid.x,
	z: pyramid.z,
	halfX: pyramid.baseX / 2 + PLATFORM_MARGIN,
	halfZ: pyramid.baseZ / 2 + PLATFORM_MARGIN
}));

export function heightOfPyramidAt(pyramid: PyramidVolume, x: number, z: number): number {
	const u = Math.abs(x - pyramid.x) / (pyramid.baseX / 2);
	const v = Math.abs(z - pyramid.z) / (pyramid.baseZ / 2);
	const rise = 1 - Math.max(u, v);
	return rise <= 0 ? 0 : Math.min(rise * pyramid.originalHeight, pyramid.currentHeight);
}
