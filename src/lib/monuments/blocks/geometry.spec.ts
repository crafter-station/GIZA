import { Vector3 } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createChamferedBoxGeometry } from './geometry.ts';

describe('chamfered box', () => {
	const geometry = createChamferedBoxGeometry(0.08);
	const position = geometry.getAttribute('position');
	const normal = geometry.getAttribute('normal');

	it('has 44 triangles inside the unit cube', () => {
		expect(position.count / 3).toBe(44);
		geometry.computeBoundingBox();
		expect(geometry.boundingBox?.min.toArray()).toEqual([-0.5, -0.5, -0.5]);
		expect(geometry.boundingBox?.max.toArray()).toEqual([0.5, 0.5, 0.5]);
	});

	it('winds every triangle outward with a matching flat normal', () => {
		const a = new Vector3();
		const b = new Vector3();
		const c = new Vector3();
		const n = new Vector3();
		for (let i = 0; i < position.count; i += 3) {
			a.fromBufferAttribute(position, i);
			b.fromBufferAttribute(position, i + 1);
			c.fromBufferAttribute(position, i + 2);
			n.fromBufferAttribute(normal, i);
			const winding = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
			expect(winding.dot(n)).toBeCloseTo(1, 5);
			expect(a.add(b).add(c).dot(n)).toBeGreaterThan(0);
		}
	});
});
