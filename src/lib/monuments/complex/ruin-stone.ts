import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';

export interface StonePoint {
	x: number;
	z: number;
}

export function stoneRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

export function chippedRectangle(width: number, depth: number, next: () => number): StonePoint[] {
	const x = width / 2;
	const z = depth / 2;
	const chip = () => Math.min(width, depth) * (0.04 + next() * 0.13);
	return [
		{ x: -x + chip(), z: -z },
		{ x: x - chip(), z: -z },
		{ x, z: -z + chip() },
		{ x, z: z - chip() },
		{ x: x - chip(), z },
		{ x: -x + chip(), z },
		{ x: -x, z: z - chip() },
		{ x: -x, z: -z + chip() }
	];
}

export function createRuinStone(
	outline: readonly StonePoint[],
	base: number,
	height: number,
	bevel: number,
	tone: number
): BufferGeometry {
	const cx = outline.reduce((sum, point) => sum + point.x, 0) / outline.length;
	const cz = outline.reduce((sum, point) => sum + point.z, 0) / outline.length;
	const inset = (point: StonePoint) => {
		const distance = Math.hypot(point.x - cx, point.z - cz);
		const factor = Math.max(0.65, 1 - bevel / distance);
		return { x: cx + (point.x - cx) * factor, z: cz + (point.z - cz) * factor };
	};
	const inner = outline.map(inset);
	const positions: number[] = [];
	const weather: number[] = [];
	const tones: number[] = [];
	const push = (point: StonePoint, y: number, edge: number) => {
		positions.push(point.x, y, point.z);
		weather.push(edge);
		tones.push(tone);
	};
	for (let i = 0; i < outline.length; i++) {
		const j = (i + 1) % outline.length;
		const a = outline[i];
		const b = outline[j];
		const ia = inner[i];
		const ib = inner[j];
		const shoulder = base + height - Math.min(bevel, height * 0.3);
		push(a, base, 0.65);
		push(b, shoulder, 1);
		push(b, base, 0.65);
		push(a, base, 0.65);
		push(a, shoulder, 1);
		push(b, shoulder, 1);
		if (bevel > 0) {
			push(a, shoulder, 1);
			push(ia, base + height, 0.45);
			push(ib, base + height, 0.45);
			push(a, shoulder, 1);
			push(ib, base + height, 0.45);
			push(b, shoulder, 1);
		}
		push({ x: cx, z: cz }, base + height, 0);
		push(ib, base + height, 0.45);
		push(ia, base + height, 0.45);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('stoneWear', new Float32BufferAttribute(weather, 1));
	geometry.setAttribute('stoneTone', new Float32BufferAttribute(tones, 1));
	geometry.computeVertexNormals();
	return geometry;
}
