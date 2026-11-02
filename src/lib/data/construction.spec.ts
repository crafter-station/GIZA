import { describe, expect, it } from 'vitest';
import { courseAtProgress, cumulativeCourseVolume, STONE_ORIGINS } from './construction.ts';
import { KHUFU_SURVIVING_COURSES_M } from './khufu-courses.ts';
import { KHUFU } from './pyramids.ts';

const cumulative = cumulativeCourseVolume(KHUFU_SURVIVING_COURSES_M, KHUFU.baseSide.value, KHUFU.originalHeight.value);

describe('build timeline', () => {
	it('adds up to the volume of the standing frustum', () => {
		const height = KHUFU_SURVIVING_COURSES_M.reduce((sum, value) => sum + value, 0);
		const base = KHUFU.baseSide.value;
		const top = base * (1 - height / KHUFU.originalHeight.value);
		const frustum = (height * (base * base + base * top + top * top)) / 3;
		expect(cumulative.at(-1)).toBeCloseTo(frustum, 0);
		expect(cumulative.at(-1)).toBeGreaterThan(KHUFU.volume.value * 0.9);
	});

	it('lays half of the volume in the lowest fifth of the height', () => {
		const half = courseAtProgress(cumulative, 0.5);
		const heightAtHalf = KHUFU_SURVIVING_COURSES_M.slice(0, Math.ceil(half)).reduce((sum, value) => sum + value, 0);
		expect(heightAtHalf / KHUFU.originalHeight.value).toBeLessThan(0.22);
	});

	it('maps progress monotonically from the first to the last course', () => {
		expect(courseAtProgress(cumulative, 0)).toBe(0);
		expect(courseAtProgress(cumulative, 1)).toBeCloseTo(cumulative.length, 6);
		let previous = -1;
		for (let p = 0; p <= 1; p += 0.01) {
			const course = courseAtProgress(cumulative, p);
			expect(course).toBeGreaterThanOrEqual(previous);
			previous = course;
		}
	});

	it('names three stone origins with sources', () => {
		expect(STONE_ORIGINS.map((origin) => origin.value.id)).toEqual(['local', 'tura', 'granite']);
		for (const origin of STONE_ORIGINS) expect(origin.sources.length).toBeGreaterThan(0);
	});
});
