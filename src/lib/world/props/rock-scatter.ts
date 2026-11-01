import type { PyramidVolume } from '../../data/layout.ts';
import type { RockShape } from './rock-geometry.ts';

export interface RockVariant {
	id: string;
	shape: RockShape;
	seed: number;
	size: number;
	weight: number;
}

export const ROCK_VARIANTS: readonly RockVariant[] = [
	{ id: 'casing-fragment', shape: 'block', seed: 11, size: 1.2, weight: 4 },
	{ id: 'core-block', shape: 'block', seed: 29, size: 2.2, weight: 3 },
	{ id: 'eroded-boulder', shape: 'boulder', seed: 47, size: 2.6, weight: 2 },
	{ id: 'rounded-stone', shape: 'boulder', seed: 83, size: 1, weight: 3 },
	{ id: 'bedrock-slab', shape: 'slab', seed: 101, size: 3.2, weight: 2 },
	{ id: 'large-block', shape: 'block', seed: 131, size: 3.6, weight: 1 }
];

export interface RockInstance {
	variant: number;
	x: number;
	z: number;
	scale: number;
	yaw: number;
	tiltX: number;
	tiltZ: number;
}

export interface Exclusion {
	x: number;
	z: number;
	halfX: number;
	halfZ: number;
}

export interface ScatterRequest {
	count: number;
	seed: number;
	pyramids: readonly PyramidVolume[];
	exclusions: readonly Exclusion[];
	field: { x: number; z: number; radius: number };
	slopeAt: (x: number, z: number) => number;
}

export const RUBBLE_SHARE = 0.45;
export const RUBBLE_BAND = 40;

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

export function insidePyramid(pyramid: PyramidVolume, x: number, z: number, margin = 0): boolean {
	return Math.abs(x - pyramid.x) < pyramid.baseX / 2 + margin && Math.abs(z - pyramid.z) < pyramid.baseZ / 2 + margin;
}

function blocked(request: ScatterRequest, x: number, z: number): boolean {
	if (request.pyramids.some((pyramid) => insidePyramid(pyramid, x, z, 2))) return true;
	return request.exclusions.some((zone) => Math.abs(x - zone.x) < zone.halfX && Math.abs(z - zone.z) < zone.halfZ);
}

export function scatterRocks(request: ScatterRequest): RockInstance[] {
	const next = random(request.seed);
	const totalWeight = ROCK_VARIANTS.reduce((sum, variant) => sum + variant.weight, 0);
	const pickVariant = () => {
		let roll = next() * totalWeight;
		for (let i = 0; i < ROCK_VARIANTS.length; i++) {
			roll -= ROCK_VARIANTS[i].weight;
			if (roll <= 0) return i;
		}
		return ROCK_VARIANTS.length - 1;
	};
	const rocks: RockInstance[] = [];
	const rubbleTarget = Math.round(request.count * RUBBLE_SHARE);
	const maxAttempts = request.count * 40;

	for (let attempt = 0; attempt < maxAttempts && rocks.length < request.count; attempt++) {
		const rubble = rocks.length < rubbleTarget;
		let x: number;
		let z: number;
		let scale: number;
		if (rubble) {
			const pyramid = request.pyramids[Math.floor(next() * request.pyramids.length)];
			const side = Math.floor(next() * 4);
			const along = next() * 2 - 1;
			const out = next() ** 2 * RUBBLE_BAND;
			const halfX = pyramid.baseX / 2 + 2 + out;
			const halfZ = pyramid.baseZ / 2 + 2 + out;
			x = pyramid.x + (side === 0 ? -halfX : side === 1 ? halfX : along * halfX);
			z = pyramid.z + (side === 2 ? -halfZ : side === 3 ? halfZ : along * halfZ);
			scale = 0.35 + next() * 0.9;
		} else {
			const angle = next() * Math.PI * 2;
			const radius = Math.sqrt(next()) * request.field.radius;
			x = request.field.x + Math.cos(angle) * radius;
			z = request.field.z + Math.sin(angle) * radius;
			const slope = request.slopeAt(x, z);
			if (next() > Math.min(0.12 + slope * 4, 1)) continue;
			scale = 0.5 + next() ** 3 * 1.6;
		}
		if (blocked(request, x, z)) continue;
		rocks.push({
			variant: pickVariant(),
			x,
			z,
			scale,
			yaw: next() * Math.PI * 2,
			tiltX: (next() - 0.5) * 0.35,
			tiltZ: (next() - 0.5) * 0.35
		});
	}
	return rocks;
}
