import { GIS_PYRAMID_CENTERS } from './giza-gis.ts';
import { KHUFU_SURVIVING_COURSES_M } from './khufu-courses.ts';
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

const at = (id: keyof typeof GIS_PYRAMID_CENTERS) => ({ x: GIS_PYRAMID_CENTERS[id].x, z: GIS_PYRAMID_CENTERS[id].z });

export const PYRAMIDS: readonly PyramidVolume[] = [
	{
		id: 'khufu',
		...at('khufu'),
		baseX: KHUFU.baseSide.value,
		baseZ: KHUFU.baseSide.value,
		originalHeight: KHUFU.originalHeight.value,
		currentHeight: KHUFU_SURVIVING_COURSES_M.reduce((sum, value) => sum + value, 0)
	},
	{
		id: 'khafre',
		...at('khafre'),
		baseX: KHAFRE.baseSide.value,
		baseZ: KHAFRE.baseSide.value,
		originalHeight: KHAFRE.originalHeight.value,
		currentHeight: KHAFRE.currentHeight.value
	},
	{
		id: 'menkaure',
		...at('menkaure'),
		baseX: MENKAURE.base.value.a,
		baseZ: MENKAURE.base.value.b,
		originalHeight: MENKAURE.originalHeight.value,
		currentHeight: MENKAURE.currentHeight.value
	}
];

const G3A_SLOPE = (52.25 * Math.PI) / 180;
const queen = (id: keyof typeof GIS_PYRAMID_CENTERS, base: number, originalHeight: number, currentHeight: number) => ({
	id,
	...at(id),
	baseX: base,
	baseZ: base,
	originalHeight,
	currentHeight
});
const stepHeight = (base: number) => (base / 2) * Math.tan(G3A_SLOPE);

export const QUEEN_PYRAMIDS: readonly PyramidVolume[] = [
	queen('g1a', QUEENS.g1a.value.base, QUEENS.g1a.value.height, QUEENS.g1a.value.height),
	queen('g1b', QUEENS.g1b.value.base, QUEENS.g1b.value.height, QUEENS.g1b.value.height),
	queen('g1c', QUEENS.g1c.value.base, QUEENS.g1c.value.height, QUEENS.g1c.value.height),
	queen('g3a', QUEENS.g3a.value.base, QUEENS.g3a.value.height, QUEENS.g3a.value.current),
	queen('g3b', QUEENS.g3b.value.base, stepHeight(QUEENS.g3b.value.base), stepHeight(QUEENS.g3b.value.base)),
	queen('g3c', QUEENS.g3b.value.base, stepHeight(QUEENS.g3b.value.base), stepHeight(QUEENS.g3b.value.base))
];

export const RECONSTRUCTED_HEIGHTS = new Set(['g1a', 'g1b', 'g1c', 'g3b', 'g3c']);

export const ALL_PYRAMIDS: readonly PyramidVolume[] = [...PYRAMIDS, ...QUEEN_PYRAMIDS];

export const SPHINX_RENDER_SCALE = 1.3;

export const SPHINX_PLACEMENT = {
	...SPHINX.position,
	length: SPHINX.size.value.length,
	height: SPHINX.size.value.height,
	width: SPHINX.size.value.width,
	renderScale: SPHINX_RENDER_SCALE,
	renderedLength: SPHINX.size.value.length * SPHINX_RENDER_SCALE,
	renderedHeight: SPHINX.size.value.height * SPHINX_RENDER_SCALE,
	renderedWidth: SPHINX.size.value.width * SPHINX_RENDER_SCALE
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
