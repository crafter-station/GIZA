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

export const HORIZON_BANDS = [
	{ until: 2048, step: 128 },
	{ until: 8192, step: 512 },
	{ until: 20480, step: 2048 }
] as const;

function horizonCoordinates(center: number, halfExtent: number): number[] {
	const outward: number[] = [];
	let distance = 0;
	for (const band of HORIZON_BANDS) {
		while (distance < band.until) {
			distance += band.step;
			outward.push(distance);
		}
	}
	const inner: number[] = [];
	for (let d = -halfExtent; d <= halfExtent; d += HORIZON_BANDS[0].step) inner.push(d);
	return [
		...outward.toReversed().map((d) => center - halfExtent - d),
		...inner.map((d) => center + d),
		...outward.map((d) => center + halfExtent + d)
	];
}

export function createHorizonGeometry(
	center: { x: number; z: number },
	halfExtent: number,
	minHeight: number,
	maxHeight: number
): BufferGeometry {
	const xs = horizonCoordinates(center.x, halfExtent);
	const zs = horizonCoordinates(center.z, halfExtent);
	const positions: number[] = [];
	for (const z of zs) for (const x of xs) positions.push(x, 0, z);
	const inside = (value: number, middle: number) => Math.abs(value - middle) < halfExtent - 1e-3;
	const indices: number[] = [];
	for (let row = 0; row < zs.length - 1; row++) {
		for (let col = 0; col < xs.length - 1; col++) {
			const midX = (xs[col] + xs[col + 1]) / 2;
			const midZ = (zs[row] + zs[row + 1]) / 2;
			if (inside(midX, center.x) && inside(midZ, center.z)) continue;
			const a = row * xs.length + col;
			const b = a + 1;
			const c = a + xs.length;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}
	const count = positions.length / 3;
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new Float32BufferAttribute(new Array(count).fill([0, 1, 0]).flat(), 3));
	geometry.setAttribute('skirt', new Float32BufferAttribute(new Array(count).fill(0), 1));
	geometry.setIndex(new Uint32BufferAttribute(indices, 1));
	const reach = halfExtent + HORIZON_BANDS[HORIZON_BANDS.length - 1].until;
	geometry.boundingBox = new Box3(
		new Vector3(center.x - reach, Math.min(minHeight, 0) - SKIRT_DEPTH, center.z - reach),
		new Vector3(center.x + reach, maxHeight + 40, center.z + reach)
	);
	geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
	return geometry;
}
