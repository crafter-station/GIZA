import { GIS_MASTABAS } from '../../data/giza-gis.ts';
import { SPHINX_PLACEMENT } from '../../data/layout.ts';
import {
	ESTIMATED_HEIGHTS,
	PLAN_FEATURES,
	type PlanPoint,
	type PlanRectangle,
	WRITTEN_FEATURES
} from './plan-features.ts';

export type RuinMaterial = 'limestone' | 'basalt' | 'granite' | 'pit';

export type RuinSource = 'gis' | 'plan' | 'written';

export interface RuinBlock {
	sector?: 'khufu-temple';
	x: number;
	z: number;
	width: number;
	depth: number;
	height: number;
	rotation: number;
	material: RuinMaterial;
	batter: number;
	source: RuinSource;
}

export interface Causeway {
	points: readonly PlanPoint[];
	width: number;
	source: RuinSource;
}

export interface ComplexLayout {
	blocks: RuinBlock[];
	causeways: Causeway[];
}

const HEIGHTS = ESTIMATED_HEIGHTS.value;
const PLAN = PLAN_FEATURES.value;

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
	rectangle: PlanRectangle,
	wallHeight: number,
	material: RuinMaterial,
	source: RuinSource
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
				batter: 0.05,
				source
			});
		}
	};
	const { minX, maxX, minZ, maxZ } = rectangle;
	addWall(minX, minZ, maxX, minZ);
	addWall(minX, maxZ, maxX, maxZ);
	addWall(minX, minZ, minX, maxZ);
	addWall(maxX, minZ, maxX, maxZ);
	return walls;
}

function centeredRectangle(center: PlanPoint, width: number, depth: number): PlanRectangle {
	return {
		minX: center.x - width / 2,
		maxX: center.x + width / 2,
		minZ: center.z - depth / 2,
		maxZ: center.z + depth / 2
	};
}

function westCemetery(next: () => number): RuinBlock[] {
	const field = PLAN.westCemetery;
	const size = PLAN.westMastaba;
	const blocks: RuinBlock[] = [];
	for (let x = field.minX; x + size.eastWest <= field.maxX; x += size.eastWest + size.eastWestGap) {
		for (let z = field.minZ; z + size.northSouth <= field.maxZ; z += size.northSouth + size.northSouthGap) {
			blocks.push({
				x: x + size.eastWest / 2,
				z: z + size.northSouth / 2,
				width: size.eastWest,
				depth: size.northSouth,
				height: HEIGHTS.mastaba * (0.7 + next() * 0.3),
				rotation: 0,
				material: 'limestone',
				batter: 0.18,
				source: 'plan'
			});
		}
	}
	return blocks;
}

function eastCemetery(next: () => number): RuinBlock[] {
	return GIS_MASTABAS.map((mastaba) => ({
		x: mastaba.x,
		z: mastaba.z,
		width: mastaba.width,
		depth: mastaba.depth,
		height: HEIGHTS.mastaba * (0.7 + next() * 0.3),
		rotation: mastaba.rotation,
		material: 'limestone',
		batter: 0.18,
		source: 'gis'
	}));
}

export function buildComplexLayout(seed = 2600): ComplexLayout {
	const next = random(seed);
	const valleyTemple = {
		x: SPHINX_PLACEMENT.x + WRITTEN_FEATURES.value.khafreValleyTempleFromSphinx.x,
		z: SPHINX_PLACEMENT.z + WRITTEN_FEATURES.value.khafreValleyTempleFromSphinx.z
	};
	const blocks: RuinBlock[] = [
		{
			...PLAN.khufuTemple,
			sector: 'khufu-temple',
			width: 40,
			depth: 52,
			height: HEIGHTS.pavement,
			rotation: 0,
			material: 'basalt',
			batter: 0,
			source: 'plan'
		},
		...ruinedEnclosure(
			next,
			centeredRectangle(PLAN.khufuTemple, 44, 56),
			HEIGHTS.templeWall * 0.75,
			'limestone',
			'plan'
		).map((block) => ({ ...block, sector: 'khufu-temple' as const })),
		...PLAN.khufuBoatPits.map((pit) => ({
			x: (pit.minX + pit.maxX) / 2,
			z: (pit.minZ + pit.maxZ) / 2,
			width: pit.maxX - pit.minX,
			depth: pit.maxZ - pit.minZ,
			height: 0.25,
			rotation: 0,
			material: 'pit' as const,
			batter: 0,
			source: 'plan' as const
		})),
		...ruinedEnclosure(next, PLAN.khafreTemple, HEIGHTS.templeWall * 1.25, 'limestone', 'plan'),
		...ruinedEnclosure(next, PLAN.menkaureTemple, HEIGHTS.templeWall, 'limestone', 'plan'),
		...ruinedEnclosure(next, centeredRectangle(valleyTemple, 45, 45), HEIGHTS.valleyTempleWall, 'granite', 'written'),
		...westCemetery(next),
		...eastCemetery(next)
	];
	const causeways: Causeway[] = [
		{ points: PLAN.khufuCauseway, width: 8, source: 'plan' },
		{ points: [...PLAN.khafreCauseway, { x: valleyTemple.x - 22, z: valleyTemple.z }], width: 6, source: 'plan' },
		{ points: PLAN.menkaureCauseway, width: 6, source: 'plan' }
	];
	return { blocks, causeways };
}

export function complexExclusions(layout: ComplexLayout): { x: number; z: number; halfX: number; halfZ: number }[] {
	const west = PLAN.westCemetery;
	const eastXs = GIS_MASTABAS.map((mastaba) => mastaba.x);
	const eastZs = GIS_MASTABAS.map((mastaba) => mastaba.z);
	const fields = [
		{
			x: (west.minX + west.maxX) / 2,
			z: (west.minZ + west.maxZ) / 2,
			halfX: (west.maxX - west.minX) / 2 + 4,
			halfZ: (west.maxZ - west.minZ) / 2 + 4
		},
		{
			x: (Math.min(...eastXs) + Math.max(...eastXs)) / 2,
			z: (Math.min(...eastZs) + Math.max(...eastZs)) / 2,
			halfX: (Math.max(...eastXs) - Math.min(...eastXs)) / 2 + 30,
			halfZ: (Math.max(...eastZs) - Math.min(...eastZs)) / 2 + 50
		}
	];
	const structures = layout.blocks
		.filter((block) => block.batter < 0.1)
		.map((block) => ({ x: block.x, z: block.z, halfX: block.width / 2 + 3, halfZ: block.depth / 2 + 3 }));
	return [...fields, ...structures];
}
