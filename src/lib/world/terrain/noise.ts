import { Fn, float, floor, int, mix, uint, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';

const HASH_OFFSET = 65536;

function hash(ix: number, iz: number): number {
	let h = (Math.imul(ix + HASH_OFFSET, 374761393) + Math.imul(iz + HASH_OFFSET, 668265263)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
	return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, z: number): number {
	const ix = Math.floor(x);
	const iz = Math.floor(z);
	const sx = fade(x - ix);
	const sz = fade(z - iz);
	const top = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * sx;
	const bottom = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * sx;
	return top + (bottom - top) * sz;
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

export const valueNoiseNode = Fn(([point]: [Node<'vec2'>]) => {
	const cell = floor(point);
	const local = point.sub(cell);
	const s = local.mul(local).mul(float(3).sub(local.mul(2)));
	const top = mix(hashNode(cell), hashNode(cell.add(vec2(1, 0))), s.x);
	const bottom = mix(hashNode(cell.add(vec2(0, 1))), hashNode(cell.add(vec2(1, 1))), s.x);
	return mix(top, bottom, s.y);
});

export function signedNoiseNode(point: Node<'vec2'>, shift: number): Node<'float'> {
	return valueNoiseNode(point.add(vec2(shift, shift * 0.37)))
		.mul(2)
		.sub(1);
}
