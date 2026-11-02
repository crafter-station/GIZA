import { getPosition, getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { GIZA_ORIGIN } from './geo.ts';
import { SPHINX_PLACEMENT } from './layout.ts';
import { DERIVED, KHAFRE, KHUFU, MENKAURE, SPHINX } from './pyramids.ts';

describe('pyramid figures', () => {
	it('keeps height consistent with base and slope (tan(slope) · base / 2)', () => {
		for (const p of [KHUFU, KHAFRE]) {
			const height = Math.tan((p.slope.value * Math.PI) / 180) * (p.baseSide.value / 2);
			expect(Math.abs(height - p.originalHeight.value)).toBeLessThan(1.5);
		}
		const menkaureHeight = Math.tan((MENKAURE.slope.value * Math.PI) / 180) * (MENKAURE.base.value.a / 2);
		expect(Math.abs(menkaureHeight - MENKAURE.originalHeight.value)).toBeLessThan(2);
	});

	it('derives the no-noon-shadow window of Khufu from the real sun', () => {
		const days: string[] = [];
		for (let d = 0; d < 365; d++) {
			const day = new Date(Date.UTC(2026, 0, 1 + d, 12));
			const noon = getTimes(day, GIZA_ORIGIN.lat, GIZA_ORIGIN.lon).solarNoon;
			if (getPosition(noon, GIZA_ORIGIN.lat, GIZA_ORIGIN.lon).altitude > KHUFU.slope.value) {
				days.push(day.toISOString().slice(5, 10));
			}
		}
		expect(days[0]).toBe(DERIVED.noNoonShadow.value.from);
		expect(days.at(-1)).toBe(DERIVED.noNoonShadow.value.to);
	});

	it('derives the building pace from the block estimate', () => {
		const { blocks, years, perDay } = DERIVED.blocksPerDay.value;
		expect(Math.round(blocks / (years * 365))).toBe(perDay);
	});

	it('scales the rendered Sphinx without changing its documented dimensions', () => {
		expect(SPHINX_PLACEMENT.renderScale).toBeGreaterThan(1);
		expect(SPHINX_PLACEMENT.renderedLength).toBe(SPHINX.size.value.length * SPHINX_PLACEMENT.renderScale);
		expect(SPHINX_PLACEMENT.renderedHeight).toBe(SPHINX.size.value.height * SPHINX_PLACEMENT.renderScale);
		expect(SPHINX_PLACEMENT.renderedWidth).toBe(SPHINX.size.value.width * SPHINX_PLACEMENT.renderScale);
		expect(SPHINX_PLACEMENT.height).toBe(SPHINX.size.value.height);
	});
});
