import { Vector3 } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createRockGeometry, type RockShape } from './rock-geometry.ts';

describe('procedural rocks', () => {
	it.each(['block', 'boulder', 'slab'] as RockShape[])('builds a unit %s resting on y = 0', (shape) => {
		const geometry = createRockGeometry(shape, 7);
		const box = geometry.boundingBox;
		if (!box) throw new Error('missing bounds');
		const size = box.getSize(new Vector3());
		expect(box.min.y).toBeCloseTo(0, 6);
		expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1, 6);
		expect(geometry.getAttribute('position').count / 3).toBe(180);
	});

	it('is deterministic per seed and different across seeds', () => {
		const a = createRockGeometry('block', 3).getAttribute('position').array;
		const b = createRockGeometry('block', 3).getAttribute('position').array;
		const c = createRockGeometry('block', 4).getAttribute('position').array;
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
	});

	it('gives slabs a flat profile and blocks a chunky one', () => {
		const height = (shape: RockShape) => createRockGeometry(shape, 9).boundingBox?.getSize(new Vector3()).y ?? 0;
		expect(height('slab')).toBeLessThan(0.4);
		expect(height('block')).toBeGreaterThan(0.45);
	});
});
