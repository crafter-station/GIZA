import { describe, expect, it } from 'vitest';
import { duneHeight } from './relief.ts';

describe('dune relief', () => {
	it('is deterministic and bounded', () => {
		let min = Number.POSITIVE_INFINITY;
		let max = Number.NEGATIVE_INFINITY;
		for (let x = -4000; x <= 4000; x += 37) {
			for (let z = -2000; z <= 6000; z += 41) {
				const h = duneHeight(x, z);
				expect(duneHeight(x, z)).toBe(h);
				min = Math.min(min, h);
				max = Math.max(max, h);
			}
		}
		expect(min).toBeGreaterThanOrEqual(-1.05);
		expect(max).toBeLessThanOrEqual(1.05);
		expect(max - min).toBeGreaterThan(1);
	});

	it('is continuous, so tiles and rocks never see steps', () => {
		for (let x = -500; x < 500; x += 13.7) {
			expect(Math.abs(duneHeight(x + 0.01, 120) - duneHeight(x, 120))).toBeLessThan(0.01);
		}
	});
});
