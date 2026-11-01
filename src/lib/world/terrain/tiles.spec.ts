import { Vector3 } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createTileGeometry, LOD_SEGMENTS, lodForDistance, TILE_SIZE } from './tiles.ts';

describe('terrain tiles', () => {
	it.each(LOD_SEGMENTS)('builds a %i-segment grid with a closed skirt', (segments) => {
		const geometry = createTileGeometry(segments, 0, 100);
		const side = segments + 1;
		const perimeter = segments * 4;
		expect(geometry.getAttribute('position').count).toBe(side * side + perimeter);
		expect((geometry.index?.count ?? 0) / 3).toBe(segments * segments * 2 + perimeter * 2);
		const skirt = geometry.getAttribute('skirt');
		let skirtVertices = 0;
		for (let i = 0; i < skirt.count; i++) skirtVertices += skirt.getX(i);
		expect(skirtVertices).toBe(perimeter);
	});

	it('faces the grid up and the skirts outward', () => {
		const geometry = createTileGeometry(16, 0, 100);
		const position = geometry.getAttribute('position');
		const skirt = geometry.getAttribute('skirt');
		const index = geometry.index;
		if (!index) throw new Error('missing index');
		const a = new Vector3();
		const b = new Vector3();
		const c = new Vector3();
		const center = new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
		for (let i = 0; i < index.count; i += 3) {
			const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
			[a, b, c].forEach((v, k) => {
				v.fromBufferAttribute(position, ids[k]);
				v.y = -skirt.getX(ids[k]);
			});
			const normal = b.clone().sub(a).cross(c.clone().sub(a));
			if (ids.some((id) => skirt.getX(id) === 1)) {
				const outward = a.clone().add(b).add(c).divideScalar(3).sub(center).setY(0);
				expect(normal.dot(outward)).toBeGreaterThan(0);
			} else expect(normal.y).toBeGreaterThan(0);
		}
	});

	it('chooses coarser levels with distance', () => {
		expect(lodForDistance(0)).toBe(0);
		expect(lodForDistance(1500)).toBe(1);
		expect(lodForDistance(3000)).toBe(2);
		expect(lodForDistance(9000)).toBe(LOD_SEGMENTS.length - 1);
		expect(lodForDistance(0, 1)).toBe(1);
	});
});
