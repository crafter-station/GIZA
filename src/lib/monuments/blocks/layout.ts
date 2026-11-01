export interface PyramidShape {
	baseSide: number;
	originalHeight: number;
	courses: readonly number[];
	coreInset: number;
}

export interface BlockLayoutRequest {
	shape: PyramidShape;
	targetCount: number;
	rows: number;
	seed: number;
	coreShare: number;
	coursesPerCoreLayer: number;
	cubicMetresPerBlock: number;
}

export interface BlockLayout {
	count: number;
	shellCount: number;
	coreCount: number;
	courses: number;
	blockLength: number;
	coreCell: number;
	blocksPerCoreCell: number;
	home: Float32Array;
	size: Float32Array;
}

export const CORE_SEED_OFFSET = 2;

const JOINT = 0.96;

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

function bottomsOf(courses: readonly number[]): number[] {
	const bottoms: number[] = [];
	let total = 0;
	for (const thickness of courses) {
		bottoms.push(total);
		total += thickness;
	}
	return bottoms;
}

function halfAt(shape: PyramidShape, y: number): number {
	return (shape.baseSide / 2) * (1 - y / shape.originalHeight) - shape.coreInset;
}

function blocksAlong(span: number, length: number): number {
	return Math.max(1, Math.round(span / length));
}

function shellCount(shape: PyramidShape, bottoms: readonly number[], rows: number, length: number): number {
	const depth = length * 0.8;
	let total = 0;
	for (let course = 0; course < shape.courses.length; course++) {
		for (let row = 0; row < rows; row++) {
			const half = halfAt(shape, bottoms[course]) - depth * (row + 0.5);
			if (half - depth / 2 <= 0) break;
			total += 2 * blocksAlong(2 * half + depth, length) + 2 * blocksAlong(2 * half - depth, length);
		}
	}
	return total;
}

interface CoreLayer {
	first: number;
	bottom: number;
	top: number;
	half: number;
}

function coreLayers(
	shape: PyramidShape,
	bottoms: readonly number[],
	rows: number,
	depth: number,
	perLayer: number
): CoreLayer[] {
	const layers: CoreLayer[] = [];
	for (let first = 0; first < shape.courses.length; first += perLayer) {
		const last = Math.min(first + perLayer, shape.courses.length) - 1;
		const top = bottoms[last] + shape.courses[last];
		const half = halfAt(shape, top) - depth * rows;
		if (half > 1) layers.push({ first, bottom: bottoms[first], top, half });
	}
	return layers;
}

function coreCount(layers: readonly CoreLayer[], cell: number): number {
	return layers.reduce((sum, layer) => sum + Math.floor((2 * layer.half) / cell) ** 2, 0);
}

function bisect(count: (value: number) => number, target: number, low: number, high: number): number {
	let short = low;
	let long = high;
	for (let i = 0; i < 40; i++) {
		const mid = (short + long) / 2;
		if (count(mid) > target) short = mid;
		else long = mid;
	}
	return long;
}

export function generateBlockLayout(request: BlockLayoutRequest): BlockLayout {
	const { shape, rows, seed } = request;
	const bottoms = bottomsOf(shape.courses);
	const shellTarget = request.targetCount * (1 - request.coreShare);
	const blockLength = bisect(
		(length) => shellCount(shape, bottoms, rows, length),
		shellTarget,
		0.2,
		shape.baseSide / 2
	);
	const depth = blockLength * 0.8;
	const layers = coreLayers(shape, bottoms, rows, depth, request.coursesPerCoreLayer);
	const coreTarget = request.targetCount * request.coreShare;
	const coreCell = bisect((cell) => coreCount(layers, cell), coreTarget, 1, shape.baseSide);
	const shell = shellCount(shape, bottoms, rows, blockLength);
	const core = coreCount(layers, coreCell);
	const count = shell + core;
	const home = new Float32Array(count * 4);
	const size = new Float32Array(count * 4);
	const next = random(seed);
	let index = 0;

	const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number, course: number, tag: number) => {
		home.set([x, y, z, course], index * 4);
		size.set([sx * JOINT, sy * JOINT, sz * JOINT, next() * 0.999 + tag], index * 4);
		index++;
	};

	for (let course = 0; course < shape.courses.length; course++) {
		const thickness = shape.courses[course];
		const y = bottoms[course] + thickness / 2;
		for (let row = 0; row < rows; row++) {
			const half = halfAt(shape, bottoms[course]) - depth * (row + 0.5);
			if (half - depth / 2 <= 0) break;
			const longSpan = 2 * half + depth;
			const shortSpan = 2 * half - depth;
			const longCount = blocksAlong(longSpan, blockLength);
			const shortCount = blocksAlong(shortSpan, blockLength);
			const longStep = longSpan / longCount;
			const shortStep = shortSpan / shortCount;
			for (let i = 0; i < longCount; i++) {
				const along = -longSpan / 2 + longStep * (i + 0.5);
				place(along, y, -half, longStep, thickness, depth, course, 0);
				place(along, y, half, longStep, thickness, depth, course, 0);
			}
			for (let i = 0; i < shortCount; i++) {
				const along = -shortSpan / 2 + shortStep * (i + 0.5);
				place(half, y, along, depth, thickness, shortStep, course, 0);
				place(-half, y, along, depth, thickness, shortStep, course, 0);
			}
		}
	}

	for (const layer of layers) {
		const cells = Math.floor((2 * layer.half) / coreCell);
		const start = -(cells * coreCell) / 2 + coreCell / 2;
		const height = layer.top - layer.bottom;
		for (let i = 0; i < cells; i++) {
			for (let j = 0; j < cells; j++) {
				place(
					start + i * coreCell,
					layer.bottom + height / 2,
					start + j * coreCell,
					coreCell,
					height,
					coreCell,
					layer.first,
					CORE_SEED_OFFSET
				);
			}
		}
	}

	const averageLayerHeight =
		layers.reduce((sum, layer) => sum + (layer.top - layer.bottom), 0) / Math.max(layers.length, 1);
	return {
		count,
		shellCount: shell,
		coreCount: core,
		courses: shape.courses.length,
		blockLength,
		coreCell,
		blocksPerCoreCell: Math.round((coreCell * coreCell * averageLayerHeight) / request.cubicMetresPerBlock),
		home,
		size
	};
}
