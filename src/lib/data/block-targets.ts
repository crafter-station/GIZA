import { type Fact, fact } from '../content/sources.ts';
import { BUILD_TIMELINE } from './construction.ts';
import { KHUFU_SURVIVING_COURSES_M } from './khufu-courses.ts';
import { DERIVED, KHAFRE, KHUFU, MENKAURE } from './pyramids.ts';

export const BLOCK_TARGET_IDS = ['khufu', 'khafre', 'menkaure'] as const;
export type BlockTargetId = (typeof BLOCK_TARGET_IDS)[number];

export interface BlockTarget {
	id: BlockTargetId;
	name: string;
	label: string;
	baseSide: number;
	originalHeight: number;
	courses: readonly number[];
	coursesMeasured: boolean;
	blockEstimate: Fact<number>;
	buildYears: number | null;
	interior: boolean;
}

const KHUFU_STANDING_HEIGHT = KHUFU_SURVIVING_COURSES_M.reduce((sum, value) => sum + value, 0);

export const SCHEMATIC_COURSE = fact(KHUFU_STANDING_HEIGHT / KHUFU_SURVIVING_COURSES_M.length, {
	unit: 'm',
	status: 'estimate',
	sources: ['petrie1883', 'birdsallLevels'],
	checked: 'computed',
	note: 'Mean thickness of Khufu’s measured courses, used as a schematic course for Khafre and Menkaure: no verified course-by-course table of those pyramids has been transcribed.'
});

function schematicCourses(currentHeight: number): number[] {
	const count = Math.round(currentHeight / SCHEMATIC_COURSE.value);
	return Array.from({ length: count }, () => currentHeight / count);
}

function derivedBlocks(volume: number): Fact<number> {
	return fact(Math.round(volume / DERIVED.cubicMetresPerBlock.value / 1000) * 1000, {
		status: 'estimate',
		sources: ['lehner1997', 'romer2007'],
		checked: 'computed',
		note: 'Volume divided by Khufu’s average block volume; a rough derived estimate, not a published count.'
	});
}

export const BLOCK_TARGETS: Record<BlockTargetId, BlockTarget> = {
	khufu: {
		id: 'khufu',
		name: 'Khufu',
		label: 'Great Pyramid · G1',
		baseSide: KHUFU.baseSide.value,
		originalHeight: KHUFU.originalHeight.value,
		courses: KHUFU_SURVIVING_COURSES_M,
		coursesMeasured: true,
		blockEstimate: KHUFU.blockCount,
		buildYears: BUILD_TIMELINE.value.years,
		interior: true
	},
	khafre: {
		id: 'khafre',
		name: 'Khafre',
		label: 'Second Pyramid · G2',
		baseSide: KHAFRE.baseSide.value,
		originalHeight: KHAFRE.originalHeight.value,
		courses: schematicCourses(KHAFRE.currentHeight.value),
		coursesMeasured: false,
		blockEstimate: derivedBlocks(KHAFRE.volume.value),
		buildYears: null,
		interior: false
	},
	menkaure: {
		id: 'menkaure',
		name: 'Menkaure',
		label: 'Third Pyramid · G3',
		baseSide: (MENKAURE.base.value.a + MENKAURE.base.value.b) / 2,
		originalHeight: MENKAURE.originalHeight.value,
		courses: schematicCourses(MENKAURE.currentHeight.value),
		coursesMeasured: false,
		blockEstimate: derivedBlocks(MENKAURE.volume.value),
		buildYears: null,
		interior: false
	}
};

export function isBlockTargetId(value: string): value is BlockTargetId {
	return (BLOCK_TARGET_IDS as readonly string[]).includes(value);
}

export function courseTopsOf(courses: readonly number[]): number[] {
	let standing = 0;
	return courses.map((thickness) => (standing += thickness));
}
