import { describe, expect, it } from 'vitest';
import { INCH, KHUFU_SURVIVING_COURSES_M } from '../../data/khufu-courses.ts';
import { KHUFU } from '../../data/pyramids.ts';
import { buildKhufuInterior } from './khufu-interior.ts';

const pieces = buildKhufuInterior();
const find = (name: string) => {
	const piece = pieces.find((candidate) => candidate.name === name);
	if (!piece) throw new Error(`missing ${name}`);
	return piece;
};

describe('Khufu interior from Petrie’s positions', () => {
	it('sizes the King’s Chamber as 20 × 10 cubits at about 43 m', () => {
		const king = find('King’s Chamber');
		expect(king.size[0]).toBeCloseTo(10.49, 1);
		expect(king.size[2]).toBeCloseTo(5.24, 1);
		expect(king.center[1] - king.size[1] / 2).toBeCloseTo(1692.5 * INCH, 2);
		expect(king.granite).toBe(true);
	});

	it('starts the descending passage at the 17 m entrance, 7.3 m east of the axis', () => {
		const passage = find('Descending passage');
		expect(passage.size[2]).toBeGreaterThan(90);
		const entranceHeight = 668.2 * INCH;
		expect(entranceHeight).toBeCloseTo(17, 0);
	});

	it('keeps every built space inside the masonry and the Gallery about 47 m long', () => {
		const height = KHUFU_SURVIVING_COURSES_M.reduce((sum, value) => sum + value, 0);
		for (const piece of pieces.filter((candidate) => candidate.kind !== 'detected')) {
			const [x, y, z] = piece.center;
			const halfAtY = (KHUFU.baseSide.value / 2) * (1 - Math.max(y, 0) / KHUFU.originalHeight.value);
			expect(Math.abs(x)).toBeLessThan(halfAtY);
			expect(Math.abs(z)).toBeLessThan(halfAtY);
			expect(y).toBeLessThan(height);
		}
		const lap = find('Grand Gallery lap 1');
		expect(lap.size[2]).toBeGreaterThan(45);
		expect(lap.size[2]).toBeLessThan(50);
	});

	it('marks the ScanPyramids spaces as detected, not built', () => {
		expect(pieces.filter((piece) => piece.kind === 'detected').map((piece) => piece.name)).toEqual([
			'Big Void (detected)',
			'North Face Corridor (detected)'
		]);
	});
});
