import { describe, expect, it } from 'vitest';
import { celestialState, directionFromAngles, isLightingMode, LIGHTING_LOOKS, sampleLighting } from './lighting.ts';

describe('Giza lighting', () => {
	it('maps north, east and the zenith to the same coordinate system as the terrain', () => {
		expect(directionFromAngles(0, 0)).toEqual([0, 0, -1]);
		expect(directionFromAngles(0, 90)[0]).toBeCloseTo(1);
		expect(directionFromAngles(90, 0)[1]).toBeCloseTo(1);
	});

	it('uses suncalc v2 degrees for an eastern dawn and western sunset', () => {
		const dawn = celestialState(LIGHTING_LOOKS.dawn.hour);
		const sunset = celestialState(LIGHTING_LOOKS.sunset.hour);
		expect(dawn.sunDirection[0]).toBeGreaterThan(0.8);
		expect(sunset.sunDirection[0]).toBeLessThan(-0.8);
		expect(dawn.sun.altitude).toBeGreaterThan(0);
		expect(sunset.sun.altitude).toBeGreaterThan(0);
		expect(celestialState(LIGHTING_LOOKS.noon.hour).sun.altitude).toBeGreaterThan(50);
	});

	it('has a visible moon and no sun above the horizon for the night reference', () => {
		const night = celestialState(LIGHTING_LOOKS.night.hour);
		expect(night.sun.altitude).toBeLessThan(-18);
		expect(night.moon.altitude).toBeGreaterThan(20);
	});

	it('samples identically when seeking forwards or backwards and never mutates presets', () => {
		const before = JSON.stringify(LIGHTING_LOOKS);
		const out = { ...LIGHTING_LOOKS.dawn };
		const first = { ...sampleLighting(4.2, 'tour', out) };
		sampleLighting(8.8, 'tour', out);
		expect(sampleLighting(4.2, 'tour', out)).toEqual(first);
		expect(JSON.stringify(LIGHTING_LOOKS)).toBe(before);
	});

	it('keeps manual lighting independent of the camera timeline and validates modes', () => {
		const out = { ...LIGHTING_LOOKS.dawn };
		expect(sampleLighting(9, 'noon', out)).toEqual(LIGHTING_LOOKS.noon);
		expect(isLightingMode('invalid')).toBe(false);
		expect(isLightingMode('night')).toBe(true);
	});

	it('produces finite values for every chapter and at invalid or out-of-range times', () => {
		const out = { ...LIGHTING_LOOKS.dawn };
		for (const t of [Number.NaN, -100, ...Array.from({ length: 111 }, (_, i) => i / 10), 100]) {
			sampleLighting(t, 'tour', out);
			expect(Object.values(out).every(Number.isFinite)).toBe(true);
			expect(out.exposure).toBeGreaterThan(0);
			expect(out.night).toBeGreaterThanOrEqual(0);
			expect(out.night).toBeLessThanOrEqual(1);
		}
	});
});
