import { describe, expect, it } from 'vitest';
import { PYRAMIDS } from '../../data/layout.ts';
import { pyramidDesigns } from './designs.ts';
import { generatePyramid, STONE } from './generator.ts';

const designs = pyramidDesigns(PYRAMIDS);

describe('pyramid generator', () => {
	it.each(designs.map((placed) => [placed.id, placed] as const))(
		'builds %s inside its budget and envelope',
		(_, placed) => {
			const mesh = generatePyramid(placed.design);
			const budget = placed.id === 'khufu' ? 320_000 : placed.id.startsWith('g') ? 20_000 : 260_000;
			expect(mesh.triangles).toBeLessThan(budget);
			expect(mesh.height).toBeCloseTo(placed.volume.currentHeight, 1);
			for (let i = 0; i < mesh.positions.length; i += 3 * 97) {
				const x = mesh.positions[i];
				const y = mesh.positions[i + 1];
				const z = mesh.positions[i + 2];
				expect(y).toBeGreaterThanOrEqual(-1e-6);
				expect(y).toBeLessThanOrEqual(mesh.height + 1e-6);
				expect(Math.abs(x)).toBeLessThanOrEqual(placed.design.baseX / 2 + 1e-3);
				expect(Math.abs(z)).toBeLessThanOrEqual(placed.design.baseZ / 2 + 1e-3);
			}
		}
	);

	it.each(designs.filter(({ id }) => ['g1a', 'g1b', 'g1c'].includes(id)).map((placed) => [placed.id, placed] as const))(
		'keeps the %s gold pyramidion at the top',
		(_, placed) => {
			const mesh = generatePyramid(placed.design);
			let pyramidionVertices = 0;
			let apexVertices = 0;
			for (let i = 0; i < mesh.positions.length; i += 3) {
				if (mesh.stone[i / 3] === STONE.pyramidion) {
					expect(mesh.positions[i + 1]).toBeGreaterThanOrEqual(
						mesh.height - (placed.design.pyramidionHeight ?? 0) - 1e-4
					);
					pyramidionVertices++;
				}
				if (Math.abs(mesh.positions[i + 1] - mesh.height) > 1e-4) continue;
				expect(Math.abs(mesh.positions[i])).toBeLessThan(1e-4);
				expect(Math.abs(mesh.positions[i + 2])).toBeLessThan(1e-4);
				apexVertices++;
			}
			expect(pyramidionVertices).toBeGreaterThan(0);
			expect(apexVertices).toBeGreaterThan(0);
		}
	);

	it('gives Khafre a smooth casing near the top and Menkaure granite at the base', () => {
		const khafre = generatePyramid(designs.find((placed) => placed.id === 'khafre')?.design ?? designs[0].design);
		const menkaure = generatePyramid(designs.find((placed) => placed.id === 'menkaure')?.design ?? designs[0].design);
		const highCasing = khafre.stone.some((stone, i) => stone === STONE.casing && khafre.positions[i * 3 + 1] > 120);
		const lowGranite = menkaure.stone.some((stone, i) => stone === STONE.granite && menkaure.positions[i * 3 + 1] < 6);
		expect(highCasing).toBe(true);
		expect(lowGranite).toBe(true);
	});

	it('cuts the entrance and the robbers’ tunnel into the north face of Khufu', () => {
		const khufu = generatePyramid(designs[0].design);
		let entrance = false;
		let tunnel = false;
		for (let i = 0; i < khufu.stone.length; i++) {
			if (khufu.stone[i] !== STONE.recess || khufu.normals[i * 3 + 2] > -0.5) continue;
			const y = khufu.positions[i * 3 + 1];
			const x = khufu.positions[i * 3];
			if (y > 14 && y < 22 && x > 5) entrance = true;
			if (y > 4 && y < 10 && Math.abs(x) < 2) tunnel = true;
		}
		expect(entrance).toBe(true);
		expect(tunnel).toBe(true);
	});

	it('is deterministic', () => {
		expect(generatePyramid(designs[2].design).positions).toEqual(generatePyramid(designs[2].design).positions);
	});
});
