import { describe, expect, it } from 'vitest';
import { RAMP_DRAWING } from '../../data/construction.ts';
import { KHUFU } from '../../data/pyramids.ts';
import { MAX_RAMP_SEGMENTS, rampSegments } from './ramps.ts';

const shape = { baseSide: KHUFU.baseSide.value, originalHeight: KHUFU.originalHeight.value, ...RAMP_DRAWING.value };
const faceHalf = (y: number) => (shape.baseSide / 2) * (1 - y / shape.originalHeight);

describe('ramp hypotheses', () => {
	it('draws nothing before the first course', () => {
		expect(rampSegments('spiral', shape, 0)).toEqual([]);
	});

	it('reaches the current building height and never goes above it', () => {
		for (const id of ['straight', 'zigzag', 'spiral', 'internal'] as const) {
			const segments = rampSegments(id, shape, 60);
			expect(segments.length).toBeGreaterThan(0);
			expect(segments.length).toBeLessThanOrEqual(MAX_RAMP_SEGMENTS);
			const top = Math.max(...segments.map((segment) => segment.to[1]));
			expect(top).toBeCloseTo(60, 6);
			for (const segment of segments) expect(segment.from[1]).toBeLessThan(segment.to[1]);
		}
	});

	it('keeps the straight ramp at its schematic slope', () => {
		const [segment] = rampSegments('straight', shape, 50);
		const run = Math.abs(segment.from[2] - segment.to[2]);
		expect(50 / run).toBeCloseTo(shape.grade, 6);
	});

	it('keeps the internal ramp inside the faces and the spiral outside', () => {
		for (const segment of rampSegments('internal', shape, 80)) {
			for (const [x, y, z] of [segment.from, segment.to])
				expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThan(faceHalf(y));
		}
		for (const segment of rampSegments('spiral', shape, 80)) {
			const [x, y, z] = segment.from;
			expect(Math.max(Math.abs(x), Math.abs(z))).toBeGreaterThan(faceHalf(y));
		}
	});
});
