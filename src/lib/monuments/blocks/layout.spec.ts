import { describe, expect, it } from 'vitest';
import { TIER_SETTINGS, TIERS } from '../../app/quality.ts';
import { KHUFU_SURVIVING_COURSES_M } from '../../data/khufu-courses.ts';
import { DERIVED, KHUFU } from '../../data/pyramids.ts';
import { type BlockLayoutRequest, CORE_SEED_OFFSET, generateBlockLayout } from './layout.ts';

const request = (targetCount: number, seed = 1): BlockLayoutRequest => ({
	shape: {
		baseSide: KHUFU.baseSide.value,
		originalHeight: KHUFU.originalHeight.value,
		courses: KHUFU_SURVIVING_COURSES_M,
		coreInset: 1.2
	},
	targetCount,
	rows: 2,
	seed,
	coreShare: 0.15,
	coursesPerCoreLayer: 10,
	cubicMetresPerBlock: DERIVED.cubicMetresPerBlock.value
});

describe('block layout', () => {
	it.each(TIERS)('hits the %s block target within 6%%', (tier) => {
		const target = TIER_SETTINGS[tier].blockTarget;
		const layout = generateBlockLayout(request(target));
		expect(Math.abs(layout.count - target) / target).toBeLessThan(0.06);
		expect(layout.shellCount + layout.coreCount).toBe(layout.count);
		expect(layout.coreCount).toBeGreaterThan(0);
		expect(layout.blocksPerCoreCell).toBeGreaterThan(1);
	});

	it('stacks the shell on the measured course heights', () => {
		const layout = generateBlockLayout(request(30_000));
		const bottoms: number[] = [];
		let total = 0;
		for (const thickness of KHUFU_SURVIVING_COURSES_M) {
			bottoms.push(total);
			total += thickness;
		}
		for (let i = 0; i < layout.shellCount; i += 37) {
			const course = layout.home[i * 4 + 3];
			const y = layout.home[i * 4 + 1];
			expect(y).toBeCloseTo(bottoms[course] + KHUFU_SURVIVING_COURSES_M[course] / 2, 4);
			expect(layout.size[i * 4 + 3]).toBeLessThan(CORE_SEED_OFFSET);
		}
	});

	it('keeps every block inside the pyramid envelope and the core inside the shell', () => {
		const layout = generateBlockLayout(request(30_000));
		for (let i = 0; i < layout.count; i++) {
			const [x, y, z] = layout.home.subarray(i * 4, i * 4 + 3);
			const halfHeight = layout.size[i * 4 + 1] / 2;
			const halfSide = (KHUFU.baseSide.value / 2) * (1 - (y - halfHeight) / KHUFU.originalHeight.value);
			expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThanOrEqual(halfSide);
			if (i >= layout.shellCount) expect(layout.size[i * 4 + 3]).toBeGreaterThanOrEqual(CORE_SEED_OFFSET);
		}
	});

	it('is deterministic for a given seed', () => {
		expect(generateBlockLayout(request(12_000, 7)).size).toEqual(generateBlockLayout(request(12_000, 7)).size);
	});
});
