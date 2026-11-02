import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BoxGeometry, type BufferGeometry, Vector3 } from 'three/webgpu';
import { valueNoise3 } from './rock-geometry.ts';

export interface BlockSize {
	length: number;
	height: number;
	width: number;
}

const SEGMENT_METRES = 0.6;
const MAX_SEGMENTS = 24;
const FACE_EPSILON = 1e-3;
const LAYER_RANGE: readonly [number, number] = [0.45, 0.85];
const STRATA_DEPTH = 0.3;
const ROUNDING_RANGE: readonly [number, number] = [0.12, 0.35];
const PITTING = 0.07;
const LUMPS = 0.07;

function segments(metres: number): number {
	return Math.min(MAX_SEGMENTS, Math.max(2, Math.round(metres / SEGMENT_METRES)));
}

function smooth(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

export function createWeatheredBlockGeometry(size: BlockSize, seed: number): BufferGeometry {
	const box = new BoxGeometry(
		size.length,
		size.height,
		size.width,
		segments(size.length),
		segments(size.height),
		segments(size.width)
	);
	const geometry = mergeVertices(box.deleteAttribute('normal').deleteAttribute('uv'));
	box.dispose();
	const half = new Vector3(size.length / 2, size.height / 2, size.width / 2);
	const layer = LAYER_RANGE[0] + ((seed * 0.6180339887) % 1) * (LAYER_RANGE[1] - LAYER_RANGE[0]);
	const phase = (seed * 0.37) % 1;
	const rounding = ROUNDING_RANGE[0] + ((seed * 0.4142135) % 1) * (ROUNDING_RANGE[1] - ROUNDING_RANGE[0]);
	const position = geometry.getAttribute('position');
	const vertex = new Vector3();
	const outward = new Vector3();
	const sample = new Vector3();
	for (let i = 0; i < position.count; i++) {
		vertex.fromBufferAttribute(position, i);
		outward.set(
			Math.abs(vertex.x) > half.x - FACE_EPSILON ? Math.sign(vertex.x) : 0,
			Math.abs(vertex.y) > half.y - FACE_EPSILON ? Math.sign(vertex.y) : 0,
			Math.abs(vertex.z) > half.z - FACE_EPSILON ? Math.sign(vertex.z) : 0
		);
		if (outward.lengthSq() === 0) continue;
		const faces = Math.abs(outward.x) + Math.abs(outward.y) + Math.abs(outward.z);
		outward.normalize();
		const tx = Math.abs(vertex.x) / half.x;
		const ty = Math.abs(vertex.y) / half.y;
		const tz = Math.abs(vertex.z) / half.z;
		const edge = Math.max(
			smooth(0.55, 1, tx) * smooth(0.55, 1, ty),
			smooth(0.55, 1, ty) * smooth(0.55, 1, tz),
			smooth(0.55, 1, tx) * smooth(0.55, 1, tz)
		);
		const vertical = outward.y < 0.5 ? 1 : 0;
		const band = 0.5 + 0.5 * Math.sin(((vertex.y + half.y) / layer + phase) * Math.PI * 2);
		const strata =
			vertical *
			band ** 6 *
			STRATA_DEPTH *
			(0.6 + 0.8 * valueNoise3(sample.set(vertex.x * 0.2, vertex.y * 0.9, vertex.z * 0.2), seed));
		const pits = (valueNoise3(sample.copy(vertex).multiplyScalar(1.9), seed + 11) - 0.5) * 2 * PITTING;
		const lumps = (valueNoise3(sample.copy(vertex).multiplyScalar(0.45), seed + 23) - 0.5) * 2 * LUMPS;
		const erosion =
			edge *
			rounding *
			(faces > 1 ? 1 : 0.6) *
			(0.7 + 0.6 * valueNoise3(sample.copy(vertex).multiplyScalar(0.7), seed + 5));
		vertex.addScaledVector(outward, lumps + pits - strata - erosion);
		position.setXYZ(i, vertex.x, vertex.y, vertex.z);
	}
	position.needsUpdate = true;
	geometry.computeVertexNormals();
	return geometry;
}
