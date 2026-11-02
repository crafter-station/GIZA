import { describe, expect, it } from 'vitest';
import { tourEra } from './timeline.ts';

describe('then and now timeline', () => {
	it('enters and leaves the reconstruction continuously and is reversible', () => {
		expect(tourEra(8.8)).toBe(0);
		expect(tourEra(9.5)).toBeCloseTo(0.5);
		expect(tourEra(9.92)).toBe(1);
		expect(tourEra(10.05)).toBeCloseTo(0.5);
		expect(tourEra(10.2)).toBe(0);
		for (let i = 0; i < 1100; i++) {
			const value = tourEra(i / 100);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});
});
