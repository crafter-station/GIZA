export type Vec3 = readonly [number, number, number];

export interface CameraKey {
	t: number;
	position: Vec3;
	target: Vec3;
	fov: number;
}

export interface CameraPose {
	position: [number, number, number];
	target: [number, number, number];
	fov: number;
}

export function createPose(): CameraPose {
	return { position: [0, 0, 0], target: [0, 0, 0], fov: 45 };
}

function hermite(p0: number, m0: number, p1: number, m1: number, h: number, s: number): number {
	const s2 = s * s;
	const s3 = s2 * s;
	return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * h * m1;
}

function secant(a: CameraKey, b: CameraKey, read: (key: CameraKey) => number): number {
	const span = b.t - a.t;
	return span > 0 ? (read(b) - read(a)) / span : 0;
}

function tangent(keys: readonly CameraKey[], i: number, read: (key: CameraKey) => number): number {
	const left = i > 0 ? secant(keys[i - 1], keys[i], read) : null;
	const right = i < keys.length - 1 ? secant(keys[i], keys[i + 1], read) : null;
	if (left === null) return right ?? 0;
	if (right === null) return left;
	if (left * right <= 0) return 0;
	const limit = 3 * Math.min(Math.abs(left), Math.abs(right));
	const average = (left + right) / 2;
	return Math.sign(average) * Math.min(Math.abs(average), limit);
}

function segmentIndex(keys: readonly CameraKey[], t: number): number {
	let low = 0;
	let high = keys.length - 2;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if (keys[mid].t <= t) low = mid;
		else high = mid - 1;
	}
	return low;
}

const READERS: readonly ((key: CameraKey) => number)[] = [
	(key) => key.position[0],
	(key) => key.position[1],
	(key) => key.position[2],
	(key) => key.target[0],
	(key) => key.target[1],
	(key) => key.target[2],
	(key) => key.fov
];

const scratch = new Float64Array(READERS.length);

export function sampleTrack(keys: readonly CameraKey[], t: number, out: CameraPose): CameraPose {
	if (keys.length === 0) throw new Error('A camera track needs at least one key');
	const clamped = Math.min(Math.max(t, keys[0].t), keys[keys.length - 1].t);
	const i = keys.length === 1 ? 0 : segmentIndex(keys, clamped);
	const a = keys[i];
	const b = keys[Math.min(i + 1, keys.length - 1)];
	const h = b.t - a.t;
	const s = h > 0 ? (clamped - a.t) / h : 0;
	const next = Math.min(i + 1, keys.length - 1);
	for (let k = 0; k < READERS.length; k++) {
		const read = READERS[k];
		scratch[k] = hermite(read(a), tangent(keys, i, read), read(b), tangent(keys, next, read), h, s);
	}
	out.position[0] = scratch[0];
	out.position[1] = scratch[1];
	out.position[2] = scratch[2];
	out.target[0] = scratch[3];
	out.target[1] = scratch[4];
	out.target[2] = scratch[5];
	out.fov = scratch[6];
	return out;
}
