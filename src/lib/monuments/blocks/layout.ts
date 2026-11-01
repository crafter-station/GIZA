export interface PyramidShape {
	baseSide: number;
	originalHeight: number;
	currentHeight: number;
	courses: number;
}

export interface BlockLayoutRequest {
	shape: PyramidShape;
	targetCount: number;
	rows: number;
	seed: number;
}

export interface BlockLayout {
	count: number;
	courses: number;
	courseHeight: number;
	blockLength: number;
	home: Float32Array;
	size: Float32Array;
}

const JOINT = 0.96;

function ringHalfSize(shape: PyramidShape, course: number, row: number, depth: number): number {
	const courseHeight = shape.currentHeight / shape.courses;
	const sideAtCourse = shape.baseSide * (1 - (course * courseHeight) / shape.originalHeight);
	return sideAtCourse / 2 - depth * (row + 0.5);
}

function blocksAlong(span: number, length: number): number {
	return Math.max(1, Math.round(span / length));
}

function countFor(shape: PyramidShape, rows: number, length: number): number {
	const depth = length * 0.8;
	let total = 0;
	for (let course = 0; course < shape.courses; course++) {
		for (let row = 0; row < rows; row++) {
			const half = ringHalfSize(shape, course, row, depth);
			if (half - depth / 2 <= 0) break;
			total += 2 * blocksAlong(2 * half + depth, length) + 2 * blocksAlong(2 * half - depth, length);
		}
	}
	return total;
}

function blockLengthFor(shape: PyramidShape, rows: number, targetCount: number): number {
	let short = 0.2;
	let long = shape.baseSide / 2;
	for (let i = 0; i < 40; i++) {
		const mid = (short + long) / 2;
		if (countFor(shape, rows, mid) > targetCount) short = mid;
		else long = mid;
	}
	return long;
}

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

export function generateBlockLayout({ shape, targetCount, rows, seed }: BlockLayoutRequest): BlockLayout {
	const blockLength = blockLengthFor(shape, rows, targetCount);
	const depth = blockLength * 0.8;
	const courseHeight = shape.currentHeight / shape.courses;
	const count = countFor(shape, rows, blockLength);
	const home = new Float32Array(count * 4);
	const size = new Float32Array(count * 4);
	const next = random(seed);
	let index = 0;

	const place = (x: number, z: number, sx: number, sz: number, course: number) => {
		home.set([x, course * courseHeight + courseHeight / 2, z, course], index * 4);
		size.set([sx * JOINT, courseHeight * JOINT, sz * JOINT, next()], index * 4);
		index++;
	};

	for (let course = 0; course < shape.courses; course++) {
		for (let row = 0; row < rows; row++) {
			const half = ringHalfSize(shape, course, row, depth);
			if (half - depth / 2 <= 0) break;
			const longSpan = 2 * half + depth;
			const shortSpan = 2 * half - depth;
			const longCount = blocksAlong(longSpan, blockLength);
			const shortCount = blocksAlong(shortSpan, blockLength);
			const longStep = longSpan / longCount;
			const shortStep = shortSpan / shortCount;
			for (let i = 0; i < longCount; i++) {
				const along = -longSpan / 2 + longStep * (i + 0.5);
				place(along, -half, longStep, depth, course);
				place(along, half, longStep, depth, course);
			}
			for (let i = 0; i < shortCount; i++) {
				const along = -shortSpan / 2 + shortStep * (i + 0.5);
				place(half, along, depth, shortStep, course);
				place(-half, along, depth, shortStep, course);
			}
		}
	}

	return { count, courses: shape.courses, courseHeight, blockLength, home, size };
}
