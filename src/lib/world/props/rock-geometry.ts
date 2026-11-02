import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { type BufferGeometry, IcosahedronGeometry, Vector3 } from 'three/webgpu';

export type RockShape = 'block' | 'boulder' | 'slab';

interface ShapeRecipe {
	stretch: readonly [number, number, number];
	cuts: number;
	cutDepth: readonly [number, number];
	axisBias: number;
	erosion: number;
}

const RECIPES: Record<RockShape, ShapeRecipe> = {
	block: { stretch: [1, 0.72, 0.86], cuts: 7, cutDepth: [0.5, 0.78], axisBias: 0.75, erosion: 0.05 },
	boulder: { stretch: [1, 0.78, 0.9], cuts: 3, cutDepth: [0.7, 0.9], axisBias: 0.2, erosion: 0.11 },
	slab: { stretch: [1.15, 0.38, 0.82], cuts: 4, cutDepth: [0.55, 0.8], axisBias: 0.6, erosion: 0.06 }
};

const BASE_LEVEL = -0.55;

function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function lattice(x: number, y: number, z: number, seed: number): number {
	let h =
		(Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1013904223)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise3(p: Vector3, seed: number): number {
	const x0 = Math.floor(p.x);
	const y0 = Math.floor(p.y);
	const z0 = Math.floor(p.z);
	const fx = p.x - x0;
	const fy = p.y - y0;
	const fz = p.z - z0;
	const sx = fx * fx * (3 - 2 * fx);
	const sy = fy * fy * (3 - 2 * fy);
	const sz = fz * fz * (3 - 2 * fz);
	let total = 0;
	for (let dz = 0; dz < 2; dz++) {
		for (let dy = 0; dy < 2; dy++) {
			for (let dx = 0; dx < 2; dx++) {
				const weight = (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz);
				total += weight * lattice(x0 + dx, y0 + dy, z0 + dz, seed);
			}
		}
	}
	return total;
}

function cutNormal(next: () => number, axisBias: number): Vector3 {
	const free = new Vector3(next() * 2 - 1, next() * 2 - 1, next() * 2 - 1).normalize();
	if (next() > axisBias) return free;
	const axis = Math.floor(next() * 3);
	const aligned = new Vector3().setComponent(axis, next() > 0.5 ? 1 : -1);
	if (aligned.y < 0) aligned.y = 1;
	return aligned.lerp(free, 0.25).normalize();
}

export function createRockGeometry(shape: RockShape, seed: number, detail = 2): BufferGeometry {
	const recipe = RECIPES[shape];
	const next = random(seed);
	const geometry = mergeVertices(new IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
	const position = geometry.getAttribute('position');
	const cuts = Array.from({ length: recipe.cuts }, () => ({
		normal: cutNormal(next, recipe.axisBias),
		depth: recipe.cutDepth[0] + next() * (recipe.cutDepth[1] - recipe.cutDepth[0])
	}));
	const vertex = new Vector3();
	const direction = new Vector3();
	const sample = new Vector3();
	for (let i = 0; i < position.count; i++) {
		vertex.fromBufferAttribute(position, i);
		direction.copy(vertex).normalize();
		const erosion =
			(valueNoise3(sample.copy(vertex).multiplyScalar(2.3), seed) - 0.5) * recipe.erosion * 2 +
			(valueNoise3(sample.copy(vertex).multiplyScalar(6.1), seed + 7) - 0.5) * recipe.erosion * 0.6;
		vertex.addScaledVector(direction, erosion);
		vertex.set(vertex.x * recipe.stretch[0], vertex.y * recipe.stretch[1], vertex.z * recipe.stretch[2]);
		for (const cut of cuts) {
			const excess = vertex.dot(cut.normal) - cut.depth;
			if (excess > 0) vertex.addScaledVector(cut.normal, -excess);
		}
		vertex.y = Math.max(vertex.y, BASE_LEVEL * recipe.stretch[1]);
		position.setXYZ(i, vertex.x, vertex.y, vertex.z);
	}
	const faceted = geometry.toNonIndexed();
	geometry.dispose();
	faceted.computeBoundingBox();
	const bounds = faceted.boundingBox;
	if (!bounds) throw new Error('Rock bounds are missing');
	const size = bounds.getSize(new Vector3());
	const center = bounds.getCenter(new Vector3());
	const unit = 1 / Math.max(size.x, size.y, size.z);
	faceted.translate(-center.x, -bounds.min.y, -center.z);
	faceted.scale(unit, unit, unit);
	faceted.computeVertexNormals();
	faceted.computeBoundingBox();
	faceted.computeBoundingSphere();
	return faceted;
}
