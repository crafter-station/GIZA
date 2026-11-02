import { abs, oneMinus, sin, smoothstep, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { valueNoise, valueNoiseNode } from './noise.ts';

function smooth(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

export function bedrockZone(x: number, z: number): number {
	return smooth(-1900, -1300, x) * (1 - smooth(500, 900, x)) * smooth(-1000, -400, z) * (1 - smooth(1600, 2200, z));
}

export function erosionHeight(x: number, z: number, platformWeight = 0): number {
	const zone = bedrockZone(x, z) * (1 - Math.max(0, Math.min(1, platformWeight))) ** 2;
	if (zone <= 0) return 0;
	const pits = smooth(0.3, 0.85, valueNoise(x / 45 + 19, z / 45 - 9));
	return -zone * pits * 0.38;
}

export function bedrockZoneNode(xz: Node<'vec2'>): Node<'float'> {
	return smoothstep(-1900, -1300, xz.x)
		.mul(oneMinus(smoothstep(500, 900, xz.x)))
		.mul(smoothstep(-1000, -400, xz.y))
		.mul(oneMinus(smoothstep(1600, 2200, xz.y)));
}

export function erosionHeightNode(xz: Node<'vec2'>, platformWeight: Node<'float'>): Node<'float'> {
	const zone = bedrockZoneNode(xz).mul(oneMinus(platformWeight).pow(2));
	const pits = smoothstep(0.3, 0.85, valueNoiseNode(xz.div(45).add(vec2(19, -9))));
	return zone.mul(pits).mul(-0.38);
}

export function fissureNode(xz: Node<'vec2'>): Node<'float'> {
	const warp = valueNoiseNode(xz.div(55).add(vec2(12, -3))).mul(2);
	const line = oneMinus(smoothstep(0.03, 0.14, abs(sin(xz.x.add(xz.y.mul(0.37)).div(11).add(warp)))));
	const gaps = smoothstep(0.45, 0.68, valueNoiseNode(xz.div(38).add(vec2(-8, 11))));
	return line.mul(gaps);
}
