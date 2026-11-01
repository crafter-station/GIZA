import { type PyramidVolume, QUEEN_PYRAMIDS } from '../../data/layout.ts';
import { KHAFRE, KHUFU, KHUFU_OPENINGS, MENKAURE } from '../../data/pyramids.ts';
import { type PyramidDesign, STONE, schematicCourses } from './generator.ts';
import { KHUFU_COURSES } from './khufu-courses.ts';

export interface PlacedDesign {
	id: string;
	volume: PyramidVolume;
	design: PyramidDesign;
	lodDistance: number;
}

const scaleTo = (courses: readonly number[], height: number) => {
	const total = courses.reduce((sum, value) => sum + value, 0);
	return courses.map((value) => (value * height) / total);
};

const khufuCourses = scaleTo(KHUFU_COURSES, KHUFU.currentHeight.value);
const sumUntil = (courses: readonly number[], count: number) =>
	courses.slice(0, count).reduce((sum, value) => sum + value, 0);

const khufu: PyramidDesign = {
	baseX: KHUFU.baseSide.value,
	baseZ: KHUFU.baseSide.value,
	originalHeight: KHUFU.originalHeight.value,
	courses: khufuCourses,
	coreInset: 1.2,
	concavity: 0.9,
	missingRate: 0.025,
	segmentLength: 3.2,
	seed: 2589,
	casings: [{ from: 0, until: khufuCourses[0], ragged: 0, coverage: 0.12, material: STONE.casing }],
	notches: [
		{
			side: 'north',
			center: KHUFU_OPENINGS.entrance.value.eastOfCenter,
			width: 4.5,
			bottom: sumUntil(khufuCourses, KHUFU_OPENINGS.entrance.value.course - 2),
			top: sumUntil(khufuCourses, KHUFU_OPENINGS.entrance.value.course + 4),
			depth: 3
		},
		{
			side: 'north',
			center: 0,
			width: 3,
			bottom: sumUntil(khufuCourses, KHUFU_OPENINGS.robbersTunnel.value.courses[0] - 1),
			top: sumUntil(khufuCourses, KHUFU_OPENINGS.robbersTunnel.value.courses[1]),
			depth: 5
		}
	]
};

const khafreCourses = schematicCourses(KHAFRE.currentHeight.value, 1.3, 0.7, 2558);
const khafre: PyramidDesign = {
	baseX: KHAFRE.baseSide.value,
	baseZ: KHAFRE.baseSide.value,
	originalHeight: KHAFRE.originalHeight.value,
	courses: khafreCourses,
	coreInset: 1.2,
	concavity: 0,
	missingRate: 0.03,
	segmentLength: 3.2,
	seed: 2558,
	casings: [
		{ from: (KHAFRE.currentHeight.value * 2) / 3, ragged: 3.5, coverage: 1, material: STONE.casing },
		{ from: 0, until: khafreCourses[0], ragged: 0, coverage: 0.25, material: STONE.granite }
	],
	notches: []
};

const menkaureCourses = schematicCourses(MENKAURE.currentHeight.value, 1.05, 0.65, 2532);
const menkaure: PyramidDesign = {
	baseX: MENKAURE.base.value.a,
	baseZ: MENKAURE.base.value.b,
	originalHeight: MENKAURE.originalHeight.value,
	courses: menkaureCourses,
	coreInset: 1,
	concavity: 0,
	missingRate: 0.035,
	segmentLength: 2.6,
	seed: 2532,
	casings: [{ from: 0, until: sumUntil(menkaureCourses, 7), ragged: 0, coverage: 0.55, material: STONE.granite }],
	notches: [{ side: 'north', center: 0, width: 10, bottom: 4, top: 24, depth: 5 }]
};

const queen = (volume: PyramidVolume, seed: number): PyramidDesign => {
	const stepped = volume.id === 'g3b' || volume.id === 'g3c';
	return {
		baseX: volume.baseX,
		baseZ: volume.baseZ,
		originalHeight: volume.originalHeight,
		courses: stepped
			? scaleTo([1, 1, 1, 1], volume.currentHeight)
			: schematicCourses(volume.currentHeight, 0.9, 0.7, seed),
		coreInset: 0.6,
		concavity: 0,
		missingRate: 0.06,
		segmentLength: 2.2,
		seed,
		casings: [],
		notches: []
	};
};

export function pyramidDesigns(main: readonly PyramidVolume[]): PlacedDesign[] {
	const byId = new Map(main.map((volume) => [volume.id, volume]));
	const required = (id: string) => {
		const volume = byId.get(id);
		if (!volume) throw new Error(`Missing pyramid volume ${id}`);
		return volume;
	};
	return [
		{ id: 'khufu', volume: required('khufu'), design: khufu, lodDistance: 1800 },
		{ id: 'khafre', volume: required('khafre'), design: khafre, lodDistance: 1800 },
		{ id: 'menkaure', volume: required('menkaure'), design: menkaure, lodDistance: 1200 },
		...QUEEN_PYRAMIDS.map((volume, index) => ({
			id: volume.id,
			volume,
			design: queen(volume, 3000 + index),
			lodDistance: 900
		}))
	];
}
