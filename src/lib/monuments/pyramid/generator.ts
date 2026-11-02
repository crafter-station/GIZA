export const STONE = { core: 0, casing: 1, granite: 2, recess: 3, roughCore: 4, pyramidion: 5 } as const;

const SMOOTH_BAND = 4;

const MAX_SETBACK = 0.22 + 1.5 + 1;

export type Side = 'north' | 'east' | 'south' | 'west';

export interface Notch {
	side: Side;
	center: number;
	width: number;
	bottom: number;
	top: number;
	depth: number;
}

export interface SmoothCasing {
	from: number;
	ragged: number;
	material: typeof STONE.casing | typeof STONE.granite;
	coverage: number;
	until?: number;
}

export interface PyramidDesign {
	baseX: number;
	baseZ: number;
	originalHeight: number;
	courses: readonly number[] | null;
	height?: number;
	pyramidionHeight?: number;
	coreInset: number;
	concavity: number;
	missingRate: number;
	segmentLength: number;
	seed: number;
	casings: readonly SmoothCasing[];
	notches: readonly Notch[];
}

export interface PyramidMeshData {
	positions: Float32Array;
	normals: Float32Array;
	stone: Float32Array;
	along: Float32Array;
	courseV: Float32Array;
	course: Float32Array;
	triangles: number;
	height: number;
}

const SIDES: readonly { side: Side; normal: [number, number]; tangent: [number, number] }[] = [
	{ side: 'north', normal: [0, -1], tangent: [1, 0] },
	{ side: 'east', normal: [1, 0], tangent: [0, 1] },
	{ side: 'south', normal: [0, 1], tangent: [-1, 0] },
	{ side: 'west', normal: [-1, 0], tangent: [0, -1] }
];

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

function lattice(seed: number, n: number): number {
	let h = (Math.imul(n, 374761393) + Math.imul(seed, 668265263)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(seed: number, x: number): number {
	const i = Math.floor(x);
	const f = x - i;
	const s = f * f * (3 - 2 * f);
	return lattice(seed, i) + (lattice(seed, i + 1) - lattice(seed, i)) * s;
}

class MeshBuilder {
	private readonly positions: number[] = [];
	private readonly normals: number[] = [];
	private readonly stone: number[] = [];
	private readonly along: number[] = [];
	private readonly courseV: number[] = [];
	private readonly course: number[] = [];

	quad(
		corners: readonly (readonly [number, number, number])[],
		normal: readonly [number, number, number],
		material: number,
		alongs: readonly number[],
		vs: readonly number[],
		courseIndex: number
	): void {
		const order = [0, 1, 2, 0, 2, 3];
		const [a, b, c] = corners;
		const ux = b[0] - a[0];
		const uy = b[1] - a[1];
		const uz = b[2] - a[2];
		const vx = c[0] - a[0];
		const vy = c[1] - a[1];
		const vz = c[2] - a[2];
		const nx = uy * vz - uz * vy;
		const ny = uz * vx - ux * vz;
		const nz = ux * vy - uy * vx;
		const flip = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;
		const indices = flip ? [0, 2, 1, 0, 3, 2] : order;
		for (const i of indices) {
			this.positions.push(corners[i][0], corners[i][1], corners[i][2]);
			this.normals.push(normal[0], normal[1], normal[2]);
			this.stone.push(material);
			this.along.push(alongs[i]);
			this.courseV.push(vs[i]);
			this.course.push(courseIndex);
		}
	}

	build(height: number): PyramidMeshData {
		return {
			positions: new Float32Array(this.positions),
			normals: new Float32Array(this.normals),
			stone: new Float32Array(this.stone),
			along: new Float32Array(this.along),
			courseV: new Float32Array(this.courseV),
			course: new Float32Array(this.course),
			triangles: this.positions.length / 9,
			height
		};
	}
}

export function generatePyramid(design: PyramidDesign): PyramidMeshData {
	const next = random(design.seed);
	const builder = new MeshBuilder();
	const bottoms: number[] = [];
	let total = 0;
	for (const thickness of design.courses ?? []) {
		bottoms.push(total);
		total += thickness;
	}
	const height = design.courses ? total : (design.height ?? 0);
	if (height <= 0) throw new Error('A smooth pyramid design needs a height');
	const halfAt = (y: number, base: number) => (base / 2) * (1 - y / design.originalHeight);
	const slopeNormal = (side: (typeof SIDES)[number], base: number): [number, number, number] => {
		const rise = base / 2 / design.originalHeight;
		const length = Math.hypot(1, rise);
		return [side.normal[0] / length, rise / length, side.normal[1] / length];
	};

	for (const side of SIDES) {
		const spanBase = side.side === 'north' || side.side === 'south' ? design.baseX : design.baseZ;
		const depthBase = side.side === 'north' || side.side === 'south' ? design.baseZ : design.baseX;
		const normal3: [number, number, number] = [side.normal[0], 0, side.normal[1]];
		const sideNotches = design.notches.filter((notch) => notch.side === side.side);
		const sideCasings = design.casings.map((casing, index) => ({
			casing,
			phase: index * 7.1 + SIDES.indexOf(side) * 3.3
		}));
		const casingStart = (casing: SmoothCasing, phase: number, u: number) =>
			casing.from + (smoothNoise(design.seed + Math.round(phase * 10), u * 9) - 0.5) * 2 * casing.ragged;
		const casingCovers = (casing: SmoothCasing, phase: number, u: number) =>
			smoothNoise(design.seed + Math.round(phase * 10) + 50, u * 5) < casing.coverage;

		const point = (alongValue: number, outward: number, y: number): [number, number, number] => [
			side.tangent[0] * alongValue + side.normal[0] * outward,
			y,
			side.tangent[1] * alongValue + side.normal[1] * outward
		];

		if (!design.courses) {
			const bands = Math.max(1, Math.ceil(height / SMOOTH_BAND));
			const columns = Math.max(4, Math.round(spanBase / design.segmentLength));
			const bandY = (band: number) => (band * height) / bands;
			const edge = (y: number, u: number) => (u * 2 - 1) * Math.max(halfAt(y, spanBase) - design.coreInset, 0);
			const surface = (y: number) => Math.max(halfAt(y, depthBase) - design.coreInset, 0);
			const notchAt = (column: number, band: number) => {
				if (column < 0 || column >= columns || band < 0 || band >= bands) return null;
				const y = (bandY(band) + bandY(band + 1)) / 2;
				const along = edge(y, (column + 0.5) / columns);
				return (
					sideNotches.find(
						(notch) => Math.abs(along - notch.center) < notch.width / 2 && y > notch.bottom && y < notch.top
					) ?? null
				);
			};
			const isCovered = (column: number, band: number) => {
				const u = (column + 0.5) / columns;
				const y0 = bandY(band);
				const y1 = bandY(band + 1);
				return sideCasings.some(
					({ casing, phase }) =>
						casingCovers(casing, phase, u) &&
						y0 >= casingStart(casing, phase, u) &&
						(casing.until === undefined || y1 <= casing.until)
				);
			};
			const normal = slopeNormal(side, depthBase);
			for (let band = 0; band < bands; band++) {
				const y0 = bandY(band);
				const y1 = bandY(band + 1);
				for (let column = 0; column < columns; column++) {
					if (isCovered(column, band)) continue;
					const u0 = column / columns;
					const u1 = (column + 1) / columns;
					const notch = notchAt(column, band);
					const depth = notch ? notch.depth : 0;
					const material = notch ? STONE.recess : STONE.roughCore;
					const at = (y: number, u: number) => point(edge(y, u), surface(y) - depth, y);
					builder.quad(
						[at(y0, u0), at(y0, u1), at(y1, u1), at(y1, u0)],
						normal,
						material,
						[edge(y0, u0), edge(y0, u1), edge(y1, u1), edge(y1, u0)],
						[0.5, 0.5, 0.5, 0.5],
						-1
					);
					if (!notch) continue;
					const outer = (y: number, u: number) => point(edge(y, u), surface(y), y);
					const walls: [boolean, [number, number], [number, number], [number, number, number]][] = [
						[!notchAt(column - 1, band), [y0, u0], [y1, u0], [side.tangent[0], 0, side.tangent[1]]],
						[!notchAt(column + 1, band), [y0, u1], [y1, u1], [-side.tangent[0], 0, -side.tangent[1]]],
						[!notchAt(column, band - 1), [y0, u0], [y0, u1], [0, 1, 0]],
						[!notchAt(column, band + 1), [y1, u0], [y1, u1], [0, -1, 0]]
					];
					for (const [open, [ya, ua], [yb, ub], wallNormal] of walls) {
						if (!open) continue;
						builder.quad(
							[outer(ya, ua), outer(yb, ub), at(yb, ub), at(ya, ua)],
							wallNormal,
							STONE.recess,
							[0, 0, 0, 0],
							[0.5, 0.5, 0.5, 0.5],
							-1
						);
					}
				}
			}
		}

		(design.courses ?? []).forEach((thickness, courseIndex) => {
			const y0 = bottoms[courseIndex];
			const y1 = y0 + thickness;
			const half = halfAt(y0, depthBase) - design.coreInset;
			const halfAbove = halfAt(y1, depthBase) - design.coreInset;
			const span = halfAt(y0, spanBase) - design.coreInset;
			if (half <= 0.3 || span <= 0.3) return;
			const breaks = new Set<number>([-span, span]);
			let cursor = -span;
			while (cursor < span) {
				cursor += design.segmentLength * (0.65 + next() * 0.7);
				if (cursor < span) breaks.add(cursor);
			}
			for (const notch of sideNotches) {
				if (notch.top <= y0 || notch.bottom >= y1) continue;
				for (const edge of [notch.center - notch.width / 2, notch.center + notch.width / 2]) {
					if (edge > -span && edge < span) breaks.add(edge);
				}
			}
			const cuts = [...breaks].sort((a, b) => a - b);
			let previousSetback: number | null = null;
			for (let i = 0; i < cuts.length - 1; i++) {
				const a = cuts[i];
				const b = cuts[i + 1];
				const mid = (a + b) / 2;
				const u = (mid + span) / (2 * span);
				const covered = sideCasings.some(
					({ casing, phase }) =>
						casingCovers(casing, phase, u) &&
						y0 >= casingStart(casing, phase, u) &&
						(casing.until === undefined || y1 <= casing.until)
				);
				if (covered) {
					previousSetback = null;
					continue;
				}
				const corner = Math.min(span - Math.abs(mid), 6) / 6;
				const erosion = (1 - corner) * 0.25 + (1 - y0 / height) * 0.1;
				let setback = next() * 0.22 + design.concavity * (1 - (2 * u - 1) ** 2);
				if (next() < design.missingRate + erosion * 0.08) setback += 0.6 + next() * 0.9;
				let material: number = STONE.core;
				for (const notch of sideNotches) {
					const inside = Math.abs(mid - notch.center) < notch.width / 2 && y0 < notch.top && y1 > notch.bottom;
					if (inside) {
						setback += notch.depth;
						material = STONE.recess;
					}
				}
				const outer = half - setback;
				builder.quad(
					[point(a, outer, y0), point(b, outer, y0), point(b, outer, y1), point(a, outer, y1)],
					normal3,
					material,
					[a, b, b, a],
					[0, 0, 1, 1],
					courseIndex
				);
				const inner = Math.max(halfAbove - MAX_SETBACK - design.concavity, 0);
				builder.quad(
					[point(a, outer, y1), point(b, outer, y1), point(b, inner, y1), point(a, inner, y1)],
					[0, 1, 0],
					material === STONE.recess ? STONE.recess : STONE.core,
					[a, b, b, a],
					[1, 1, 1, 1],
					courseIndex
				);
				if (previousSetback !== null && Math.abs(previousSetback - setback) > 0.01) {
					const near = half - Math.min(previousSetback, setback);
					const far = half - Math.max(previousSetback, setback);
					const facing = previousSetback < setback ? 1 : -1;
					builder.quad(
						[point(a, near, y0), point(a, far, y0), point(a, far, y1), point(a, near, y1)],
						[side.tangent[0] * facing, 0, side.tangent[1] * facing],
						material,
						[a, a, a, a],
						[0, 0, 1, 1],
						courseIndex
					);
				}
				previousSetback = setback;
			}
		});

		for (const { casing, phase } of sideCasings) {
			const columns = Math.max(4, Math.round(spanBase / design.segmentLength / 2));
			for (let column = 0; column < columns; column++) {
				const u0 = column / columns;
				const u1 = (column + 1) / columns;
				const uMid = (u0 + u1) / 2;
				if (!casingCovers(casing, phase, uMid)) continue;
				const start = Math.max(0, casingStart(casing, phase, uMid));
				const stop = Math.min(height, casing.until ?? height);
				if (stop <= start) continue;
				const edgeAt = (y: number, u: number) => (u * 2 - 1) * halfAt(y, spanBase);
				const outward = (y: number) => halfAt(y, depthBase);
				builder.quad(
					[
						point(edgeAt(start, u0), outward(start), start),
						point(edgeAt(start, u1), outward(start), start),
						point(edgeAt(stop, u1), outward(stop), stop),
						point(edgeAt(stop, u0), outward(stop), stop)
					],
					slopeNormal(side, depthBase),
					casing.material,
					[edgeAt(start, u0), edgeAt(start, u1), edgeAt(stop, u1), edgeAt(stop, u0)],
					[start, start, stop, stop],
					-1
				);
			}
		}
	}

	const topX = halfAt(height, design.baseX);
	const topZ = halfAt(height, design.baseZ);
	if (topX > 0.05 && topZ > 0.05) {
		builder.quad(
			[
				[-topX, height, -topZ],
				[topX, height, -topZ],
				[topX, height, topZ],
				[-topX, height, topZ]
			],
			[0, 1, 0],
			STONE.core,
			[-topX, topX, topX, -topX],
			[1, 1, 1, 1],
			(design.courses?.length ?? 1) - 1
		);
	}
	if (design.pyramidionHeight) {
		const baseY = height - design.pyramidionHeight;
		const radiusX = Math.max(halfAt(baseY, design.baseX) - design.coreInset, 0);
		const radiusZ = Math.max(halfAt(baseY, design.baseZ) - design.coreInset, 0);
		for (const side of SIDES) {
			const span = side.side === 'north' || side.side === 'south' ? radiusX : radiusZ;
			const depth = side.side === 'north' || side.side === 'south' ? radiusZ : radiusX;
			const point = (along: number, outward: number): [number, number, number] => [
				side.tangent[0] * along + side.normal[0] * outward,
				baseY,
				side.tangent[1] * along + side.normal[1] * outward
			];
			const apex: [number, number, number] = [0, height, 0];
			builder.quad(
				[point(-span, depth), point(span, depth), apex, apex],
				slopeNormal(side, side.side === 'north' || side.side === 'south' ? design.baseZ : design.baseX),
				STONE.pyramidion,
				[-span, span, 0, 0],
				[baseY, baseY, height, height],
				-1
			);
		}
	}
	return builder.build(height);
}
