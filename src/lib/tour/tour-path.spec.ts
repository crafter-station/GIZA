import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_PYRAMIDS, FLATTENED_FOOTPRINTS, heightOfPyramidAt, PYRAMIDS, SPHINX_PLACEMENT } from '../data/layout.ts';
import { decodeHeights, type TerrainHeightmapMeta } from '../data/terrain.ts';
import { causewayBlocks } from '../monuments/complex/complex.ts';
import { buildComplexLayout } from '../monuments/complex/layout.ts';
import { createGroundSampler } from '../world/terrain/relief.ts';
import { flattenFootprints } from '../world/terrain/shape.ts';
import { CHAPTERS, chapterVisibility, resolveCameraKeys } from './chapters.ts';
import { createPose, sampleTrack } from './track.ts';

const meta = JSON.parse(readFileSync('static/terrain/giza-height.json', 'utf8')) as TerrainHeightmapMeta;
const bin = readFileSync(`static/terrain/${meta.file}`);
const raw = decodeHeights(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2), meta);
const groundAt = createGroundSampler(flattenFootprints(raw, meta, FLATTENED_FOOTPRINTS), meta);
const keys = resolveCameraKeys(CHAPTERS, groundAt);
const end = CHAPTERS.length;
const complex = buildComplexLayout();
const structures = [...complex.blocks, ...causewayBlocks(complex, groundAt)];

const SUBJECTS: Record<string, readonly [number, number] | null> = {
	dawn: [PYRAMIDS[0].x, PYRAMIDS[0].z],
	plateau: [PYRAMIDS[2].x, PYRAMIDS[2].z],
	khufu: [PYRAMIDS[0].x, PYRAMIDS[0].z],
	'inside-khufu': [PYRAMIDS[0].x, PYRAMIDS[0].z],
	khafre: [SPHINX_PLACEMENT.x, SPHINX_PLACEMENT.z],
	menkaure: [PYRAMIDS[2].x, PYRAMIDS[2].z],
	building: [PYRAMIDS[0].x, PYRAMIDS[0].z],
	'sun-and-shadow': [PYRAMIDS[0].x, PYRAMIDS[0].z],
	'ancient-sky': null,
	'then-and-now': [PYRAMIDS[0].x, PYRAMIDS[0].z],
	explore: [PYRAMIDS[1].x, PYRAMIDS[1].z]
};

describe('tour camera path', () => {
	it('keeps keys in time order', () => {
		for (let i = 1; i < keys.length; i++) expect(keys[i].t).toBeGreaterThan(keys[i - 1].t);
	});

	it('never goes through the ground, a pyramid, or the Sphinx', () => {
		const pose = createPose();
		const clearance = 8;
		for (let t = 0; t <= end; t += 0.002) {
			const [x, y, z] = sampleTrack(keys, t, pose).position;
			const ground = groundAt(x, z);
			expect(y - ground, `ground at t=${t.toFixed(3)}`).toBeGreaterThan(clearance);
			ALL_PYRAMIDS.forEach((pyramid, i) => {
				const platform = groundAt(pyramid.x, pyramid.z);
				const top = platform + heightOfPyramidAt(pyramid, x, z);
				const near =
					heightOfPyramidAt(
						{ ...pyramid, baseX: pyramid.baseX + 2 * clearance, baseZ: pyramid.baseZ + 2 * clearance },
						x,
						z
					) > 0;
				if (near) expect(y, `${ALL_PYRAMIDS[i].id} at t=${t.toFixed(3)}`).toBeGreaterThan(top + clearance);
			});
			for (const block of structures) {
				const inside =
					Math.abs(x - block.x) < block.width / 2 + clearance && Math.abs(z - block.z) < block.depth / 2 + clearance;
				if (inside) expect(y - ground, `structure at t=${t.toFixed(3)}`).toBeGreaterThan(block.height + clearance);
			}
			const insideSphinx =
				Math.abs(x - SPHINX_PLACEMENT.x) < SPHINX_PLACEMENT.length / 2 + clearance &&
				Math.abs(z - SPHINX_PLACEMENT.z) < SPHINX_PLACEMENT.width / 2 + clearance;
			if (insideSphinx) expect(y - ground).toBeGreaterThan(SPHINX_PLACEMENT.height + clearance);
		}
	});

	it.each(CHAPTERS.flatMap((chapter, index) => (SUBJECTS[chapter.id] ? [[chapter.id, index] as const] : [])))(
		'frames its subject in %s',
		(id, index) => {
			const subject = SUBJECTS[id] as readonly [number, number];
			const pose = sampleTrack(keys, index + 0.5, createPose());
			const [px, py, pz] = pose.position;
			const [tx, ty, tz] = pose.target;
			const sy = groundAt(subject[0], subject[1]) + 20;
			const view = [tx - px, ty - py, tz - pz];
			const toSubject = [subject[0] - px, sy - py, subject[1] - pz];
			const dot = view[0] * toSubject[0] + view[1] * toSubject[1] + view[2] * toSubject[2];
			const angle = (Math.acos(dot / (Math.hypot(...view) * Math.hypot(...toSubject))) * 180) / Math.PI;
			expect(angle).toBeLessThan(pose.fov / 2);
		}
	);

	it('shows exactly one chapter text at the hold point of each chapter', () => {
		CHAPTERS.forEach((_, index) => {
			const visible = CHAPTERS.map((__, j) => chapterVisibility(index + 0.5, j, CHAPTERS.length));
			expect(visible.filter((v) => v > 0)).toEqual([1]);
		});
	});
});
