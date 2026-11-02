import { dot, float, fract, oneMinus, select, smoothstep, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { WIND_DIRECTION_XZ } from '../atmosphere/wind.ts';
import { bedrockZone, bedrockZoneNode } from './erosion.ts';
import { valueNoise, valueNoiseNode } from './noise.ts';
import { quarryMask, quarryMaskNode } from './quarry.ts';

const RIDGE_WAVELENGTH = 44;
const RIDGE_AMPLITUDE = 1.6;
const SLIP_FACE_START = 0.78;
const WARP_SCALE = 90;
const WARP_DISTANCE = 58;
const FIELD_SCALE = 170;
const CREST_SCALE: readonly [number, number] = [48, 160];
const ROCK_SUPPRESSION = 0.45;
const VALLEY_EDGE: readonly [number, number] = [450, 800];
const [WX, WZ] = WIND_DIRECTION_XZ;

function smooth(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function profile(t: number): number {
	return t < SLIP_FACE_START ? smooth(0, SLIP_FACE_START, t) : 1 - smooth(SLIP_FACE_START, 1, t);
}

export function ridgeHeight(x: number, z: number, platform: number): number {
	const mask =
		(1 - ROCK_SUPPRESSION * bedrockZone(x, z)) *
		(1 - Math.min(Math.max(platform, 0), 1)) ** 2 *
		(1 - quarryMask(x, z)) *
		(1 - smooth(VALLEY_EDGE[0], VALLEY_EDGE[1], x));
	if (mask <= 0) return 0;
	const along = x * WX + z * WZ;
	const across = -x * WZ + z * WX;
	const field = smooth(0.35, 0.65, valueNoise(x / FIELD_SCALE + 5.2, z / FIELD_SCALE - 1.7));
	const crest = smooth(0.3, 0.7, valueNoise(across / CREST_SCALE[0] - 2.4, along / CREST_SCALE[1] + 7.9));
	const warp = (valueNoise(x / WARP_SCALE + 1.3, z / WARP_SCALE + 6.6) - 0.5) * WARP_DISTANCE;
	const phase = (along + warp) / RIDGE_WAVELENGTH;
	return RIDGE_AMPLITUDE * mask * field * crest * profile(phase - Math.floor(phase));
}

export function ridgeHeightNode(xz: Node<'vec2'>, platform: Node<'float'>): Node<'float'> {
	const mask = oneMinus(bedrockZoneNode(xz).mul(ROCK_SUPPRESSION))
		.mul(oneMinus(platform.clamp(0, 1)).pow(2))
		.mul(oneMinus(quarryMaskNode(xz)))
		.mul(oneMinus(smoothstep(VALLEY_EDGE[0], VALLEY_EDGE[1], xz.x)));
	const along = dot(xz, vec2(WX, WZ));
	const across = dot(xz, vec2(-WZ, WX));
	const field = smoothstep(0.35, 0.65, valueNoiseNode(xz.div(FIELD_SCALE).add(vec2(5.2, -1.7))));
	const crest = smoothstep(
		0.3,
		0.7,
		valueNoiseNode(vec2(across.div(CREST_SCALE[0]).sub(2.4), along.div(CREST_SCALE[1]).add(7.9)))
	);
	const warp = valueNoiseNode(xz.div(WARP_SCALE).add(vec2(1.3, 6.6)))
		.sub(0.5)
		.mul(WARP_DISTANCE);
	const t = fract(along.add(warp).div(RIDGE_WAVELENGTH));
	const shape = select(
		t.lessThan(SLIP_FACE_START),
		smoothstep(0, SLIP_FACE_START, t),
		oneMinus(smoothstep(SLIP_FACE_START, 1, t))
	);
	return float(RIDGE_AMPLITUDE).mul(mask, field, crest, shape);
}
