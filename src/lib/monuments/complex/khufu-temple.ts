import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type BufferGeometry, Group, LOD, Mesh, type MeshStandardNodeMaterial } from 'three/webgpu';
import { createArchaeologicalStoneMaterial } from '#lib/materials/archaeological-stone.ts';
import type { RuinBlock } from './layout.ts';
import { PLAN_FEATURES } from './plan-features.ts';
import { chippedRectangle, createRuinStone, type StonePoint, stoneRandom } from './ruin-stone.ts';

const CENTER = PLAN_FEATURES.value.khufuTemple;
const LOD_DISTANCE = 320;
const COURSE_HEIGHT = 0.62;
const JOINT = 0.035;

interface SlabSurface {
	outline: readonly StonePoint[];
	top: number;
}

function surfaceAt(surfaces: readonly SlabSurface[], x: number, z: number): number {
	for (const { outline, top } of surfaces) {
		const inside = outline.every((point, i) => {
			const next = outline[(i + 1) % outline.length];
			return (next.x - point.x) * (z - point.z) - (next.z - point.z) * (x - point.x) >= 0;
		});
		if (inside) return top;
	}
	return 0.08;
}

function mergeStones(parts: BufferGeometry[], material: MeshStandardNodeMaterial, name: string): Mesh {
	const geometry = mergeGeometries(parts);
	for (const part of parts) part.dispose();
	geometry.computeBoundingSphere();
	const mesh = new Mesh(geometry, material);
	mesh.name = name;
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function pavement(
	block: RuinBlock,
	base: number,
	limestone: BufferGeometry[],
	basalt: BufferGeometry[],
	detailed: boolean
): SlabSurface[] {
	const next = stoneRandom(4419);
	const surfaces: SlabSurface[] = [];
	const columns = 14;
	const rows = 18;
	const dx = block.width / columns;
	const dz = block.depth / rows;
	const grid: StonePoint[][] = [];
	for (let row = 0; row <= rows; row++) {
		grid.push(
			Array.from({ length: columns + 1 }, (_, column) => ({
				x: -block.width / 2 + column * dx + (column > 0 && column < columns ? (next() - 0.5) * dx * 0.65 : 0),
				z: -block.depth / 2 + row * dz + (row > 0 && row < rows ? (next() - 0.5) * dz * 0.5 : 0)
			}))
		);
	}
	limestone.push(createRuinStone(chippedRectangle(block.width, block.depth, next), base - 0.7, 0.78, 0.08, 0.55));
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const outer = row === 0 || column === 0 || row === rows - 1 || column === columns - 1;
			const loss = next();
			if (outer && loss < 0.42) continue;
			const points = [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1], grid[row + 1][column]];
			const cx = points.reduce((sum, point) => sum + point.x, 0) / 4;
			const cz = points.reduce((sum, point) => sum + point.z, 0) / 4;
			if ((cx < -9 && cz > 9 && loss < 0.8) || loss < 0.035) continue;
			const outline = points.map((point) => ({
				x: point.x + (cx - point.x) * JOINT,
				z: point.z + (cz - point.z) * JOINT
			}));
			const top = block.height - 0.12 + (next() - 0.5) * 0.065;
			const tone = next();
			if (next() < 0.17) {
				for (const triangle of [
					[outline[0], outline[1], outline[2]],
					[outline[0], outline[2], outline[3]]
				]) {
					const tx = triangle.reduce((sum, point) => sum + point.x, 0) / 3;
					const tz = triangle.reduce((sum, point) => sum + point.z, 0) / 3;
					const fragment = triangle.map((point) => ({
						x: point.x + (tx - point.x) * 0.025,
						z: point.z + (tz - point.z) * 0.025
					}));
					const fragmentTop = top - next() * 0.04;
					basalt.push(createRuinStone(fragment, base + 0.07, fragmentTop - 0.07, detailed ? 0.035 : 0, tone));
					surfaces.push({ outline: fragment, top: base + fragmentTop });
				}
			} else {
				basalt.push(createRuinStone(outline, base + 0.07, top - 0.07, detailed ? 0.045 : 0, tone));
				surfaces.push({ outline, top: base + top });
			}
		}
	}
	return surfaces;
}

function wallStones(block: RuinBlock, base: number, detailed: boolean, seed: number): BufferGeometry[] {
	const next = stoneRandom(seed);
	const stones: BufferGeometry[] = [];
	const alongX = block.width > block.depth;
	const length = Math.max(block.width, block.depth);
	const thickness = Math.min(block.width, block.depth);
	const courses = detailed ? Math.ceil((block.height + 0.3) / COURSE_HEIGHT) : 1;
	const courseHeight = (block.height + 0.3) / courses;
	for (let course = 0; course < courses; course++) {
		const taper = 1 - block.batter * ((course + 0.5) / courses);
		const span = length * taper;
		let start = -span / 2;
		let index = 0;
		while (start < span / 2 - 0.05) {
			const size = Math.min(span / 2 - start, detailed ? (index === 0 && course % 2 ? 0.8 : 1.3) + next() * 0.9 : span);
			const height = courseHeight - (detailed ? 0.025 : 0);
			const topCourse = course === courses - 1;
			if (!detailed || !topCourse || next() > 0.22) {
				const shape = chippedRectangle(Math.max(0.06, size - 0.025), thickness * taper, next);
				const stone = createRuinStone(
					shape,
					base - 0.3 + course * courseHeight,
					height * (detailed && topCourse ? 0.6 + next() * 0.4 : 1),
					detailed ? 0.055 + next() * 0.04 : 0,
					next()
				);
				stone.translate(start + size / 2, 0, 0);
				if (!alongX) stone.rotateY(Math.PI / 2);
				stone.translate(block.x - CENTER.x, 0, block.z - CENTER.z);
				stones.push(stone);
			}
			start += size;
			index++;
		}
	}
	return stones;
}

export function createKhufuTemple(blocks: readonly RuinBlock[], groundAt: (x: number, z: number) => number): LOD {
	const floor = blocks.find((block) => block.material === 'basalt');
	if (!floor) throw new Error('Khufu temple requires its existing pavement footprint.');
	const materials = {
		limestone: createArchaeologicalStoneMaterial('limestone'),
		basalt: createArchaeologicalStoneMaterial('basalt')
	};
	const lod = new LOD();
	lod.name = 'khufu-temple-sector';
	const elevation = groundAt(CENTER.x, CENTER.z);
	lod.position.set(CENTER.x, elevation, CENTER.z);
	for (const detailed of [true, false]) {
		const limestone: BufferGeometry[] = [];
		const basalt: BufferGeometry[] = [];
		const surfaces = pavement(floor, 0, limestone, basalt, detailed);
		blocks.forEach((block, i) => {
			if (block.material !== 'limestone') return;
			const base = groundAt(block.x, block.z) - elevation;
			limestone.push(...wallStones(block, base, detailed, 3301 + i * 97));
			if (!detailed) return;
			const next = stoneRandom(9103 + i * 31);
			for (let chip = 0; chip < 3; chip++) {
				const inwardX = Math.sign(CENTER.x - block.x);
				const inwardZ = Math.sign(CENTER.z - block.z);
				const x = block.x + inwardX * (block.width / 2 + 0.4 + next() * 1.2);
				const z = block.z + inwardZ * (block.depth / 2 + 0.4 + next() * 1.2);
				const stone = createRuinStone(
					chippedRectangle(0.25 + next() * 0.7, 0.3 + next() * 0.5, next),
					0,
					0.15 + next() * 0.3,
					0.06,
					next()
				);
				stone.rotateY(next() * Math.PI);
				const onPavement = Math.abs(x - CENTER.x) < floor.width / 2 && Math.abs(z - CENTER.z) < floor.depth / 2;
				stone.translate(
					x - CENTER.x,
					Math.max(
						groundAt(x, z) - elevation - 0.05,
						onPavement ? surfaceAt(surfaces, x - CENTER.x, z - CENTER.z) - 0.03 : -Infinity
					),
					z - CENTER.z
				);
				limestone.push(stone);
			}
		});
		const level = new Group();
		level.name = detailed ? 'temple-detail' : 'temple-distant';
		level.add(mergeStones(limestone, materials.limestone, 'temple-limestone'));
		level.add(mergeStones(basalt, materials.basalt, 'temple-basalt'));
		lod.addLevel(level, detailed ? 0 : LOD_DISTANCE, 0.12);
	}
	return lod;
}

export function disposeKhufuTemple(lod: LOD): void {
	const materials = new Set<MeshStandardNodeMaterial>();
	lod.traverse((object) => {
		if (!(object instanceof Mesh)) return;
		object.geometry.dispose();
		materials.add(object.material as MeshStandardNodeMaterial);
	});
	for (const material of materials) material.dispose();
	lod.removeFromParent();
}
