import { Box3, BufferGeometry, Float32BufferAttribute, Sphere, Uint32BufferAttribute, Vector3 } from 'three/webgpu';

export const TILE_SIZE = 1024;
export const LOD_SEGMENTS = [128, 64, 32, 16] as const;
export const LOD_DISTANCES = [900, 1900, 3800] as const;
export const SKIRT_DEPTH = 24;
export const DETAIL_HEADROOM = 4;

export function lodForDistance(distance: number, bias = 0): number {
	let level = LOD_DISTANCES.findIndex((limit) => distance < limit);
	if (level < 0) level = LOD_DISTANCES.length;
	return Math.min(level + bias, LOD_SEGMENTS.length - 1);
}

export function createTileGeometry(segments: number, minHeight: number, maxHeight: number): BufferGeometry {
	const side = segments + 1;
	const step = TILE_SIZE / segments;
	const positions: number[] = [];
	const skirts: number[] = [];
	const indices: number[] = [];

	for (let row = 0; row < side; row++) {
		for (let col = 0; col < side; col++) {
			positions.push(col * step, 0, row * step);
			skirts.push(0);
		}
	}
	for (let row = 0; row < segments; row++) {
		for (let col = 0; col < segments; col++) {
			const a = row * side + col;
			const b = a + 1;
			const c = a + side;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}

	const perimeter: number[] = [];
	for (let col = 0; col < segments; col++) perimeter.push(col);
	for (let row = 0; row < segments; row++) perimeter.push(row * side + segments);
	for (let col = segments; col > 0; col--) perimeter.push(segments * side + col);
	for (let row = segments; row > 0; row--) perimeter.push(row * side);

	const skirtStart = positions.length / 3;
	for (const vertex of perimeter) {
		positions.push(positions[vertex * 3], 0, positions[vertex * 3 + 2]);
		skirts.push(1);
	}
	for (let i = 0; i < perimeter.length; i++) {
		const j = (i + 1) % perimeter.length;
		const a = perimeter[i];
		const b = perimeter[j];
		const lowA = skirtStart + i;
		const lowB = skirtStart + j;
		indices.push(a, b, lowA, b, lowB, lowA);
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute(
		'normal',
		new Float32BufferAttribute(
			skirts.flatMap(() => [0, 1, 0]),
			3
		)
	);
	geometry.setAttribute('skirt', new Float32BufferAttribute(skirts, 1));
	geometry.setIndex(new Uint32BufferAttribute(indices, 1));
	geometry.boundingBox = new Box3(
		new Vector3(0, minHeight - SKIRT_DEPTH - DETAIL_HEADROOM, 0),
		new Vector3(TILE_SIZE, maxHeight + DETAIL_HEADROOM, TILE_SIZE)
	);
	geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
	return geometry;
}
