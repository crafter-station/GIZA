import { KHAFRE, KHUFU, MENKAURE, SPHINX } from './pyramids.ts';

export interface PyramidVolume {
	id: 'khufu' | 'khafre' | 'menkaure';
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

export const SPHINX_PLACEMENT = {
	...SPHINX.position,
	length: SPHINX.size.value.length,
	height: SPHINX.size.value.height,
	width: SPHINX.size.value.width
};

export const PLATFORM_MARGIN = 25;

export const FLATTENED_FOOTPRINTS: readonly Footprint[] = PYRAMIDS.map((pyramid) => ({
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
