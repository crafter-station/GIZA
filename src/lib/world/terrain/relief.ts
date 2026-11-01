import { Fn, float, floor, int, mix, uint, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { sampleHeight, type TerrainHeightmapMeta } from '../../data/terrain.ts';
import type { ShapedTerrain } from './shape.ts';

export const PLATFORM_DAMPING = 0.85;

const HASH_OFFSET = 65536;
const OCTAVES = [
	{ wavelength: 220, amplitude: 1.6, shiftX: 0, shiftZ: 0 },
	{ wavelength: 57, amplitude: 0.5, shiftX: 17.3, shiftZ: -4.1 }
] as const;

function hash(ix: number, iz: number): number {
	let h = (Math.imul(ix + HASH_OFFSET, 374761393) + Math.imul(iz + HASH_OFFSET, 668265263)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
	return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
	const ix = Math.floor(x);
	const iz = Math.floor(z);
	const sx = fade(x - ix);
	const sz = fade(z - iz);
	const top = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * sx;
	const bottom = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * sx;
	return top + (bottom - top) * sz;
}

export function duneHeight(x: number, z: number): number {
	let total = 0;
	for (const octave of OCTAVES) {
		total +=
			(valueNoise(x / octave.wavelength + octave.shiftX, z / octave.wavelength + octave.shiftZ) - 0.5) *
			octave.amplitude;
	}
	return total;
}

export function createGroundSampler(
	shaped: ShapedTerrain,
	meta: TerrainHeightmapMeta
): (x: number, z: number) => number {
	return (x, z) =>
		sampleHeight(shaped.heights, meta, x, z) +
		duneHeight(x, z) * (1 - PLATFORM_DAMPING * sampleHeight(shaped.platformWeight, meta, x, z));
}

const hashNode = Fn(([cell]: [Node<'vec2'>]) => {
	const ix = uint(int(cell.x).add(HASH_OFFSET));
	const iz = uint(int(cell.y).add(HASH_OFFSET));
	const mixed = ix
		.mul(uint(374761393))
		.add(iz.mul(uint(668265263)))
		.toVar();
	mixed.assign(mixed.bitXor(mixed.shiftRight(uint(13))).mul(uint(1274126177)));
	mixed.assign(mixed.bitXor(mixed.shiftRight(uint(16))));
	return float(mixed).div(4294967296);
});

const valueNoiseNode = Fn(([point]: [Node<'vec2'>]) => {
	const cell = floor(point);
	const local = point.sub(cell);
	const s = local.mul(local).mul(float(3).sub(local.mul(2)));
	const top = mix(hashNode(cell), hashNode(cell.add(vec2(1, 0))), s.x);
	const bottom = mix(hashNode(cell.add(vec2(0, 1))), hashNode(cell.add(vec2(1, 1))), s.x);
	return mix(top, bottom, s.y);
});

export function duneHeightNode(xz: Node<'vec2'>): Node<'float'> {
	let total: Node<'float'> = float(0);
	for (const octave of OCTAVES) {
		const point = xz.div(octave.wavelength).add(vec2(octave.shiftX, octave.shiftZ));
		total = total.add(valueNoiseNode(point).sub(0.5).mul(octave.amplitude));
	}
	return total;
}
