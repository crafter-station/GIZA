import { abs, float, floor, fract, max, min, oneMinus, smoothstep, step, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { QUARRY_TRACE } from '../../data/quarry.ts';
import { valueNoise, valueNoiseNode } from './noise.ts';

const TRACE = QUARRY_TRACE.value;
const CAUSEWAY_SLOPE = (TRACE.causeway.to.z - TRACE.causeway.from.z) / (TRACE.causeway.to.x - TRACE.causeway.from.x);
const NORTH_BASE = TRACE.causeway.from.z + TRACE.northOffsetFromCauseway - TRACE.causeway.from.x * CAUSEWAY_SLOPE;
const BENCH_WIDTH = 14;
const BENCH_COUNT = 3;
const RISER_FRACTION = 0.05;
const PRIMARY_SPACING = 24;
const PRIMARY_WIDTH = 1.4;
const SECONDARY_SPACING: readonly [number, number] = [3.4, 2.3];
const SECONDARY_WIDTH = 0.45;
const PRIMARY_FADE = 300;
const SECONDARY_FADE = 70;

function smooth(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function northRim(x: number): number {
	return NORTH_BASE + x * CAUSEWAY_SLOPE;
}

export function quarryMask(x: number, z: number): number {
	const soft = TRACE.edgeSoftness;
	return (
		smooth(TRACE.west, TRACE.west + soft, x) *
		smooth(-TRACE.east, -TRACE.east + soft, -x) *
		smooth(northRim(x), northRim(x) + soft, z) *
		(1 - smooth(TRACE.southFadeStart, TRACE.southFadeEnd, z))
	);
}

function benchCut(depth: number, widthScale: number): number {
	const level = Math.max(0, Math.min(depth / (BENCH_WIDTH * widthScale), BENCH_COUNT));
	const base = Math.min(Math.floor(level), BENCH_COUNT);
	const stepped = base >= BENCH_COUNT ? BENCH_COUNT : base + smooth(1 - RISER_FRACTION, 1, level - base);
	return -stepped * TRACE.terraceStep;
}

function wallDistance(x: number, z: number): number {
	return Math.min(x - TRACE.west, TRACE.east - x, z - northRim(x));
}

export function quarryOffset(x: number, z: number): number {
	const south = 1 - smooth(TRACE.southFadeStart, TRACE.southFadeEnd, z);
	if (south <= 0) return 0;
	const widthScale = 0.8 + valueNoise(x / 90 + 3.1, z / 90 - 8.4) * 0.4;
	return south * benchCut(wallDistance(x, z), widthScale);
}

export function quarryMaskNode(xz: Node<'vec2'>): Node<'float'> {
	const soft = TRACE.edgeSoftness;
	const rim = float(NORTH_BASE).add(xz.x.mul(CAUSEWAY_SLOPE));
	return smoothstep(TRACE.west, TRACE.west + soft, xz.x)
		.mul(smoothstep(-TRACE.east, -TRACE.east + soft, xz.x.negate()))
		.mul(smoothstep(rim, rim.add(soft), xz.y))
		.mul(oneMinus(smoothstep(TRACE.southFadeStart, TRACE.southFadeEnd, xz.y)));
}

export function quarryOffsetNode(xz: Node<'vec2'>): Node<'float'> {
	const south = oneMinus(smoothstep(TRACE.southFadeStart, TRACE.southFadeEnd, xz.y));
	const widthScale = valueNoiseNode(xz.div(90).add(vec2(3.1, -8.4)))
		.mul(0.4)
		.add(0.8);
	const rim = float(NORTH_BASE).add(xz.x.mul(CAUSEWAY_SLOPE));
	const depth = min(min(xz.x.sub(TRACE.west), float(TRACE.east).sub(xz.x)), xz.y.sub(rim));
	const level = depth.div(widthScale.mul(BENCH_WIDTH)).clamp(0, BENCH_COUNT);
	const base = min(floor(level), BENCH_COUNT);
	const riser = smoothstep(1 - RISER_FRACTION, 1, level.sub(base)).mul(oneMinus(step(BENCH_COUNT, base)));
	return south.mul(base.add(riser).mul(-TRACE.terraceStep));
}

function groove(coordinate: Node<'float'>, spacing: number, width: number): Node<'float'> {
	const offset = abs(fract(coordinate.div(spacing)).sub(0.5)).mul(spacing);
	return oneMinus(smoothstep(width * 0.35, width * 0.5, float(spacing / 2).sub(offset)));
}

export function quarryChannelsNode(xz: Node<'vec2'>, distance: Node<'float'>): Node<'float'> {
	const mask = quarryMaskNode(xz);
	const primary = max(groove(xz.x, PRIMARY_SPACING, PRIMARY_WIDTH), groove(xz.y, PRIMARY_SPACING, PRIMARY_WIDTH)).mul(
		oneMinus(smoothstep(PRIMARY_FADE * 0.5, PRIMARY_FADE, distance))
	);
	const cells = valueNoiseNode(xz.div(38).add(vec2(-6.2, 4.7)));
	const secondary = max(
		groove(xz.x.add(cells.mul(1.3)), SECONDARY_SPACING[0], SECONDARY_WIDTH),
		groove(xz.y, SECONDARY_SPACING[1], SECONDARY_WIDTH)
	)
		.mul(smoothstep(0.64, 0.74, cells))
		.mul(oneMinus(smoothstep(SECONDARY_FADE * 0.5, SECONDARY_FADE, distance)));
	const patches = smoothstep(0.56, 0.7, valueNoiseNode(xz.div(64).add(vec2(11.3, 2.9))));
	return mask.mul(min(max(primary, secondary).mul(patches), 1));
}
