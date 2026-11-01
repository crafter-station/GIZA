import { PYRAMIDS, SPHINX_PLACEMENT } from '../../data/layout.ts';

export type RuinMaterial = 'limestone' | 'basalt' | 'granite';

export interface RuinBlock {
	x: number;
	z: number;
	width: number;
	depth: number;
	height: number;
	rotation: number;
	material: RuinMaterial;
	batter: number;
}

export interface Causeway {
	from: { x: number; z: number };
	to: { x: number; z: number };
	width: number;
}

export interface ComplexLayout {
	blocks: RuinBlock[];
	causeways: Causeway[];
}

export const CEMETERIES = {
	west: { minX: -470, maxX: -170, minZ: -260, maxZ: 120, length: 22, width: 11, height: 4.5, gap: 9 },
	east: { minX: 245, maxX: 345, minZ: -25, maxZ: 175, length: 34, width: 16, height: 5.5, gap: 10 }
} as const;

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

function ruinedEnclosure(
	next: () => number,
	cx: number,
	cz: number,
	width: number,
	depth: number,
	wallHeight: number,
	material: RuinMaterial
): RuinBlock[] {
	const walls: RuinBlock[] = [];
	const thickness = 3;
	const segment = 6;
	const addWall = (x0: number, z0: number, x1: number, z1: number) => {
		const length = Math.hypot(x1 - x0, z1 - z0);
		const count = Math.max(1, Math.round(length / segment));
		for (let i = 0; i < count; i++) {
			if (next() < 0.18) continue;
			const t = (i + 0.5) / count;
			walls.push({
				x: x0 + (x1 - x0) * t,
				z: z0 + (z1 - z0) * t,
				width: x0 === x1 ? thickness : length / count,
				depth: x0 === x1 ? length / count : thickness,
				height: wallHeight * (0.25 + next() * 0.75),
				rotation: 0,
				material,
				batter: 0.05
			});
		}
	};
	const hx = width / 2;
	const hz = depth / 2;
	addWall(cx - hx, cz - hz, cx + hx, cz - hz);
	addWall(cx - hx, cz + hz, cx + hx, cz + hz);
	addWall(cx - hx, cz - hz, cx - hx, cz + hz);
	addWall(cx + hx, cz - hz, cx + hx, cz + hz);
	return walls;
}

function mastabaField(next: () => number, field: (typeof CEMETERIES)[keyof typeof CEMETERIES]): RuinBlock[] {
	const blocks: RuinBlock[] = [];
	for (let x = field.minX; x + field.width <= field.maxX; x += field.width + field.gap) {
		for (let z = field.minZ; z + field.length <= field.maxZ; z += field.length + field.gap) {
			if (next() < 0.12) continue;
			blocks.push({
				x: x + field.width / 2 + (next() - 0.5) * 2,
				z: z + field.length / 2 + (next() - 0.5) * 2,
				width: field.width * (0.85 + next() * 0.3),
				depth: field.length * (0.85 + next() * 0.3),
				height: field.height * (0.55 + next() * 0.45),
				rotation: 0,
				material: 'limestone',
				batter: 0.18
			});
		}
	}
	return blocks;
}

export function buildComplexLayout(seed = 2600): ComplexLayout {
	const next = random(seed);
	const [khufu, khafre, menkaure] = PYRAMIDS;
	const east = (pyramid: (typeof PYRAMIDS)[number], offset: number) => pyramid.x + pyramid.baseX / 2 + offset;
	const valleyTemple = { x: SPHINX_PLACEMENT.x + 15, z: SPHINX_PLACEMENT.z + 70 };
	const blocks: RuinBlock[] = [
		{ x: east(khufu, 24), z: khufu.z, width: 40, depth: 52, height: 0.6, rotation: 0, material: 'basalt', batter: 0 },
		...ruinedEnclosure(next, east(khufu, 24), khufu.z, 44, 56, 3, 'limestone'),
		...ruinedEnclosure(next, east(khafre, 55), khafre.z, 100, 55, 5, 'limestone'),
		...ruinedEnclosure(next, east(menkaure, 35), menkaure.z, 55, 45, 4, 'limestone'),
		...ruinedEnclosure(next, valleyTemple.x, valleyTemple.z, 45, 45, 7, 'granite'),
		...mastabaField(next, CEMETERIES.west),
		...mastabaField(next, CEMETERIES.east)
	];
	const causeways: Causeway[] = [
		{ from: { x: east(khufu, 55), z: khufu.z - 10 }, to: { x: 780, z: -260 }, width: 8 },
		{ from: { x: east(khafre, 105), z: khafre.z }, to: { x: valleyTemple.x - 22, z: valleyTemple.z }, width: 6 },
		{ from: { x: east(menkaure, 62), z: menkaure.z }, to: { x: -60, z: 790 }, width: 6 }
	];
	return { blocks, causeways };
}

export function complexExclusions(layout: ComplexLayout): { x: number; z: number; halfX: number; halfZ: number }[] {
	const fields = Object.values(CEMETERIES).map((field) => ({
		x: (field.minX + field.maxX) / 2,
		z: (field.minZ + field.maxZ) / 2,
		halfX: (field.maxX - field.minX) / 2 + 4,
		halfZ: (field.maxZ - field.minZ) / 2 + 4
	}));
	const structures = layout.blocks
		.filter((block) => block.batter < 0.1)
		.map((block) => ({ x: block.x, z: block.z, halfX: block.width / 2 + 3, halfZ: block.depth / 2 + 3 }));
	return [...fields, ...structures];
}
