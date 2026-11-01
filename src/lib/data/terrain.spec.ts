import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeHeights, sampleHeight, type TerrainHeightmapMeta } from './terrain.ts';

const meta = JSON.parse(readFileSync('static/terrain/giza-height.json', 'utf8')) as TerrainHeightmapMeta;
const bin = readFileSync(`static/terrain/${meta.file}`);
const heights = decodeHeights(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2), meta);

describe('Giza heightmap', () => {
	it('has the declared size', () => {
		expect(heights.length).toBe(meta.size * meta.size);
	});

	it('covers every monument', () => {
		for (const check of Object.values(meta.verification)) {
			expect(Math.abs(check.expected.x - meta.center.x)).toBeLessThan(meta.halfExtent);
			expect(Math.abs(check.expected.z - meta.center.z)).toBeLessThan(meta.halfExtent);
		}
	});

	it('finds each pyramid as a DSM peak close to its reference coordinates', () => {
		for (const id of ['khufu', 'khafre', 'menkaure']) {
			const check = meta.verification[id];
			expect(check.offset).toBeLessThan(80);
			expect(check.prominence).toBeGreaterThan(15);
		}
	});

	it('puts the plateau above the Nile valley to the east', () => {
		const plateau = sampleHeight(heights, meta, -400, 400);
		const valley = sampleHeight(heights, meta, 2500, 400);
		expect(plateau - valley).toBeGreaterThan(20);
	});
});
