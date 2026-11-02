import { InstancedMesh, type Material, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { QUARRY_TRACE } from '../../data/quarry.ts';
import { createChamferedBoxGeometry } from '../../monuments/blocks/geometry.ts';
import { quarryMask } from '../terrain/quarry.ts';
import { ROCK_VARIANTS, type RockInstance } from './rock-scatter.ts';

const TRACE = QUARRY_TRACE.value;
const CLUSTERS = 22;
const BLOCKS_PER_CLUSTER = [6, 16] as const;
const CLUSTER_RADIUS = 14;
const WADI_BLOCKS = 70;
const WADI = { from: { x: 60, z: 690 }, to: { x: 300, z: 830 }, width: 70 } as const;

const variantIndex = (id: string) => ROCK_VARIANTS.findIndex((variant) => variant.id === id);
const CUT_BLOCK = variantIndex('casing-fragment');
const CORE_BLOCK = variantIndex('core-block');

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

export function quarryRocks(seed: number): RockInstance[] {
	const next = random(seed);
	const rocks: RockInstance[] = [];
	const discarded = (x: number, z: number, sunk: boolean) => {
		const variant = next() < 0.7 ? CUT_BLOCK : CORE_BLOCK;
		rocks.push({
			variant,
			x,
			z,
			scale: (0.75 + next() * 0.5) * (sunk ? 0.8 : 1),
			yaw: (next() - 0.5) * (sunk ? Math.PI : 0.6),
			tiltX: (next() - 0.5) * (sunk ? 0.5 : 0.12),
			tiltZ: (next() - 0.5) * (sunk ? 0.5 : 0.12)
		});
	};

	for (let cluster = 0, attempts = 0; cluster < CLUSTERS && attempts < 400; attempts++) {
		const cx = TRACE.west + next() * (TRACE.east - TRACE.west);
		const cz = TRACE.causeway.from.z + next() * (TRACE.southFadeEnd - TRACE.causeway.from.z);
		if (quarryMask(cx, cz) < 0.6) continue;
		cluster++;
		const count = BLOCKS_PER_CLUSTER[0] + Math.floor(next() * (BLOCKS_PER_CLUSTER[1] - BLOCKS_PER_CLUSTER[0]));
		for (let i = 0; i < count; i++) {
			const angle = next() * Math.PI * 2;
			const reach = Math.sqrt(next()) * CLUSTER_RADIUS;
			const x = cx + Math.cos(angle) * reach;
			const z = cz + Math.sin(angle) * reach;
			if (quarryMask(x, z) > 0.3) discarded(x, z, false);
		}
	}

	const dx = WADI.to.x - WADI.from.x;
	const dz = WADI.to.z - WADI.from.z;
	const length = Math.hypot(dx, dz);
	for (let i = 0; i < WADI_BLOCKS; i++) {
		const along = next() ** 1.6;
		const across = (next() - 0.5) * WADI.width * (1 - along * 0.4);
		const x = WADI.from.x + dx * along - (dz / length) * across;
		const z = WADI.from.z + dz * along + (dx / length) * across;
		if (next() > along * 0.85) discarded(x, z, true);
	}

	return rocks;
}

const BEDROCK_PITCH = 19;
const BEDROCK_FOOTPRINT: readonly [number, number] = [9, 15];
const BEDROCK_HEIGHT: readonly [number, number] = [2, 6];
const BURIED_DEPTH = 3;
const MONOLITH = { length: 4.6, width: 3.2, height: 2.4, buried: 0.6 } as const;
const CHAMFER = 0.07;
const BEDROCK_JITTER = 6;
const BEDROCK_GAP = 0.3;
const CAP_SHARE = 0.5;

export interface BedrockBlock {
	x: number;
	z: number;
	length: number;
	width: number;
	height: number;
	yaw: number;
	buried: number;
	cap: { dx: number; dz: number; length: number; width: number; height: number } | null;
}

export function quarryBedrock(seed: number): BedrockBlock[] {
	const next = random(seed);
	const { bedrock, monolith } = TRACE;
	const blocks: BedrockBlock[] = [];
	const span = (range: readonly [number, number]) => range[0] + next() * (range[1] - range[0]);
	for (let x = bedrock.minX; x <= bedrock.maxX; x += BEDROCK_PITCH) {
		for (let z = bedrock.minZ; z <= bedrock.maxZ; z += BEDROCK_PITCH) {
			if (Math.hypot(x - monolith.x, z - monolith.z) < BEDROCK_PITCH) continue;
			if (next() < BEDROCK_GAP) continue;
			blocks.push({
				x: x + (next() - 0.5) * BEDROCK_JITTER,
				z: z + (next() - 0.5) * BEDROCK_JITTER,
				length: Math.min(span(BEDROCK_FOOTPRINT), BEDROCK_PITCH - 3),
				width: Math.min(span(BEDROCK_FOOTPRINT), BEDROCK_PITCH - 3),
				height: span(BEDROCK_HEIGHT),
				yaw: (next() - 0.5) * 0.12,
				buried: BURIED_DEPTH,
				cap: null
			});
			const block = blocks[blocks.length - 1];
			if (next() < CAP_SHARE)
				block.cap = {
					dx: (next() - 0.5) * block.length * 0.35,
					dz: (next() - 0.5) * block.width * 0.35,
					length: block.length * (0.45 + next() * 0.25),
					width: block.width * (0.5 + next() * 0.3),
					height: 0.8 + next() * 1.6
				};
		}
	}
	blocks.push({ x: monolith.x, z: monolith.z, ...MONOLITH, yaw: 0.02, cap: null });
	return blocks;
}

export function createBedrockBlocks(
	blocks: readonly BedrockBlock[],
	groundAt: (x: number, z: number) => number,
	material: Material
): InstancedMesh {
	const count = blocks.reduce((total, block) => total + (block.cap ? 2 : 1), 0);
	const mesh = new InstancedMesh(createChamferedBoxGeometry(CHAMFER), material, count);
	let index = 0;
	mesh.name = 'quarry-bedrock';
	const matrix = new Matrix4();
	const rotation = new Quaternion();
	const position = new Vector3();
	const scale = new Vector3();
	const up = new Vector3(0, 1, 0);
	for (const block of blocks) {
		const corners = [-1, 1].flatMap((sx) =>
			[-1, 1].map((sz) => groundAt(block.x + (sx * block.length) / 2, block.z + (sz * block.width) / 2))
		);
		const bottom = Math.min(...corners) - block.buried;
		const top = Math.max(...corners) + block.height - block.buried * 0.2;
		position.set(block.x, (top + bottom) / 2, block.z);
		rotation.setFromAxisAngle(up, block.yaw);
		scale.set(block.length, top - bottom, block.width);
		mesh.setMatrixAt(index++, matrix.compose(position, rotation, scale));
		if (!block.cap) continue;
		const offset = new Vector3(block.cap.dx, 0, block.cap.dz).applyQuaternion(rotation);
		position.set(block.x + offset.x, top + block.cap.height / 2 - 0.2, block.z + offset.z);
		scale.set(block.cap.length, block.cap.height + 0.4, block.cap.width);
		mesh.setMatrixAt(index++, matrix.compose(position, rotation, scale));
	}
	mesh.instanceMatrix.needsUpdate = true;
	mesh.computeBoundingSphere();
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}
