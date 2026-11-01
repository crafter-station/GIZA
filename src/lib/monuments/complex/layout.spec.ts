import { describe, expect, it } from 'vitest';
import { ALL_PYRAMIDS } from '../../data/layout.ts';
import { causewayBlocks } from './complex.ts';
import { buildComplexLayout } from './layout.ts';

const layout = buildComplexLayout();
const overlapsPyramid = (x: number, z: number, halfX: number, halfZ: number) =>
	ALL_PYRAMIDS.some(
		(pyramid) =>
			Math.abs(x - pyramid.x) < pyramid.baseX / 2 + halfX && Math.abs(z - pyramid.z) < pyramid.baseZ / 2 + halfZ
	);

describe('pyramid complexes', () => {
	it('keeps temples and mastabas off every pyramid', () => {
		for (const block of layout.blocks) {
			expect(overlapsPyramid(block.x, block.z, block.width / 2, block.depth / 2)).toBe(false);
		}
	});

	it('runs the causeways without crossing a pyramid', () => {
		for (const block of causewayBlocks(layout, () => 0)) {
			expect(overlapsPyramid(block.x, block.z, block.width / 2, block.width / 2)).toBe(false);
		}
	});

	it('includes the basalt pavement, a granite valley temple and both mastaba fields', () => {
		expect(layout.blocks.some((block) => block.material === 'basalt')).toBe(true);
		expect(layout.blocks.some((block) => block.material === 'granite')).toBe(true);
		expect(layout.blocks.filter((block) => block.batter > 0.15).length).toBeGreaterThan(100);
	});
});
