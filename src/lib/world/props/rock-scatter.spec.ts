import { describe, expect, it } from 'vitest';
import { TIER_SETTINGS, TIERS } from '../../app/quality.ts';
import { PYRAMIDS, SPHINX_PLACEMENT } from '../../data/layout.ts';
import { insidePyramid, ROCK_VARIANTS, RUBBLE_BAND, type ScatterRequest, scatterRocks } from './rock-scatter.ts';

const sphinxZone = { x: SPHINX_PLACEMENT.x, z: SPHINX_PLACEMENT.z, halfX: 60, halfZ: 35 };
const request = (count: number): ScatterRequest => ({
	count,
	seed: 2589,
	pyramids: PYRAMIDS,
	exclusions: [sphinxZone],
	field: { x: -250, z: 450, radius: 1400 },
	slopeAt: (x) => (Math.sin(x / 90) + 1) * 0.1
});

describe('rock scatter', () => {
	it.each(TIERS)('places the %s rock count', (tier) => {
		expect(scatterRocks(request(TIER_SETTINGS[tier].rockCount))).toHaveLength(TIER_SETTINGS[tier].rockCount);
	});

	it('keeps rocks off the pyramids and out of the Sphinx enclosure', () => {
		for (const rock of scatterRocks(request(2400))) {
			for (const pyramid of PYRAMIDS) expect(insidePyramid(pyramid, rock.x, rock.z)).toBe(false);
			const inSphinx =
				Math.abs(rock.x - sphinxZone.x) < sphinxZone.halfX && Math.abs(rock.z - sphinxZone.z) < sphinxZone.halfZ;
			expect(inSphinx).toBe(false);
			expect(rock.variant).toBeLessThan(ROCK_VARIANTS.length);
		}
	});

	it('piles rubble along the bases of the pyramids', () => {
		const rocks = scatterRocks(request(2000));
		const nearBase = rocks.filter((rock) =>
			PYRAMIDS.some((pyramid) => insidePyramid(pyramid, rock.x, rock.z, RUBBLE_BAND + 3))
		);
		expect(nearBase.length / rocks.length).toBeGreaterThan(0.4);
	});

	it('is deterministic', () => {
		expect(scatterRocks(request(300))).toEqual(scatterRocks(request(300)));
	});
});
