import { describe, expect, it } from 'vitest';
import { bedrockZone, erosionHeight } from './erosion.ts';

describe('bedrock erosion', () => {
	it('adds shallow recesses in the plateau and leaves the valley untouched', () => {
		let min = 0;
		for (let x = -1200; x <= 400; x += 17) {
			for (let z = -200; z <= 1400; z += 19) {
				const height = erosionHeight(x, z);
				min = Math.min(min, height);
				expect(height).toBeGreaterThanOrEqual(-0.38);
				expect(height).toBeLessThanOrEqual(0);
			}
		}
		expect(min).toBeLessThan(-0.33);
		expect(bedrockZone(1600, 300)).toBe(0);
		expect(erosionHeight(1600, 300)).toBe(0);
	});

	it('preserves foundations and stays continuous across tile edges', () => {
		for (let x = -800; x < 700; x += 31) {
			const height = erosionHeight(x, 620);
			expect(erosionHeight(x, 620, 1)).toBe(0);
			expect(erosionHeight(x, 620, 0.5)).toBeCloseTo(height * 0.25, 8);
			expect(Math.abs(erosionHeight(x + 0.01, 620) - height)).toBeLessThan(0.01);
		}
		expect(Math.abs(erosionHeight(1024 - 0.01, 440) - erosionHeight(1024 + 0.01, 440))).toBeLessThan(0.01);
	});
});
