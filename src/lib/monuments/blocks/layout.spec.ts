import { describe, expect, it } from 'vitest';
import { TIER_SETTINGS, TIERS } from '../../app/quality.ts';
import { KHUFU } from '../../data/pyramids.ts';
import { generateBlockLayout, type PyramidShape } from './layout.ts';

const shape: PyramidShape = {
	baseSide: KHUFU.baseSide.value,
	originalHeight: KHUFU.originalHeight.value,
	currentHeight: KHUFU.currentHeight.value,
	courses: KHUFU.courses.value
};

describe('block layout', () => {
	it.each(TIERS)('hits the %s block target within 5%%', (tier) => {
		const target = TIER_SETTINGS[tier].blockTarget;
		const layout = generateBlockLayout({ shape, targetCount: target, rows: 2, seed: 1 });
		expect(Math.abs(layout.count - target) / target).toBeLessThan(0.05);
		expect(layout.home.length).toBe(layout.count * 4);
	});

	it('keeps every block inside the pyramid envelope and orders courses bottom-up', () => {
		const layout = generateBlockLayout({ shape, targetCount: 30_000, rows: 2, seed: 1 });
		let previousCourse = 0;
		for (let i = 0; i < layout.count; i++) {
			const [x, y, z, course] = layout.home.subarray(i * 4, i * 4 + 4);
			const halfSide = (shape.baseSide * (1 - (y - layout.courseHeight / 2) / shape.originalHeight)) / 2;
			expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThanOrEqual(halfSide + 1e-3);
			expect(y).toBeLessThan(shape.currentHeight);
			expect(course).toBeGreaterThanOrEqual(previousCourse);
			previousCourse = course;
		}
	});

	it('is deterministic for a given seed', () => {
		const a = generateBlockLayout({ shape, targetCount: 12_000, rows: 2, seed: 7 });
		const b = generateBlockLayout({ shape, targetCount: 12_000, rows: 2, seed: 7 });
		expect(a.size).toEqual(b.size);
	});
});
