import { KHUFU_SURVIVING_COURSES_M } from '../../data/khufu-courses.ts';
import { type PyramidVolume, QUEEN_PYRAMIDS } from '../../data/layout.ts';
import { KHAFRE, KHUFU, KHUFU_OPENINGS, MENKAURE_GRANITE } from '../../data/pyramids.ts';
import { type PyramidDesign, STONE } from './generator.ts';

export interface PlacedDesign {
	id: string;
	volume: PyramidVolume;
	design: PyramidDesign;
	lodDistance: number;
}

const sumUntil = (courses: readonly number[], count: number) =>
	courses.slice(0, count).reduce((sum, value) => sum + value, 0);

const khufuCourses = KHUFU_SURVIVING_COURSES_M;

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

const smooth = (volume: PyramidVolume, seed: number, extra: Partial<PyramidDesign> = {}): PyramidDesign => ({
	baseX: volume.baseX,
	baseZ: volume.baseZ,
	originalHeight: volume.originalHeight,
	courses: null,
	height: volume.currentHeight,
	coreInset: 1,
	concavity: 0,
	missingRate: 0,
	segmentLength: 4,
	seed,
	casings: [],
	notches: [],
	...extra
});

const stepped = (volume: PyramidVolume, steps: number, seed: number): PyramidDesign => ({
	...smooth(volume, seed),
	courses: Array.from({ length: steps }, () => volume.currentHeight / steps),
	coreInset: 0.6,
	missingRate: 0.06,
	segmentLength: 2.2
});

export function pyramidDesigns(main: readonly PyramidVolume[]): PlacedDesign[] {
	const byId = new Map(main.map((volume) => [volume.id, volume]));
	const required = (id: string) => {
		const volume = byId.get(id);
		if (!volume) throw new Error(`Missing pyramid volume ${id}`);
		return volume;
	};
	const khafre = required('khafre');
	const menkaure = required('menkaure');
	return [
		{ id: 'khufu', volume: required('khufu'), design: khufu, lodDistance: 1800 },
		{
			id: 'khafre',
			volume: khafre,
			design: smooth(khafre, 2558, {
				casings: [{ from: (KHAFRE.currentHeight.value * 2) / 3, ragged: 3.5, coverage: 1, material: STONE.casing }]
			}),
			lodDistance: 1800
		},
		{
			id: 'menkaure',
			volume: menkaure,
			design: smooth(menkaure, 2532, {
				casings: [
					{
						from: 0,
						until: MENKAURE_GRANITE.value.survivingHeight,
						ragged: 0,
						coverage: 0.55,
						material: STONE.granite
					}
				],
				notches: [{ side: 'north', center: 0, width: 10, bottom: 4, top: 24, depth: 5 }]
			}),
			lodDistance: 1200
		},
		...QUEEN_PYRAMIDS.map((volume, index) => ({
			id: volume.id,
			volume,
			design:
				volume.id === 'g3b' || volume.id === 'g3c' ? stepped(volume, 4, 3000 + index) : smooth(volume, 3000 + index),
			lodDistance: 900
		}))
	];
}
