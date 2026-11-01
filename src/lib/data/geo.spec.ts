import { describe, expect, it } from 'vitest';
import { GIZA_ORIGIN, MONUMENT_COORDINATES, toGeo, toLocal } from './geo.ts';

describe('local frame', () => {
	it('places Khufu at the origin', () => {
		expect(toLocal(GIZA_ORIGIN)).toEqual({ x: 0, z: 0 });
	});

	it('maps east to +x and north to -z', () => {
		const northEast = toLocal({ lat: GIZA_ORIGIN.lat + 0.001, lon: GIZA_ORIGIN.lon + 0.001 });
		expect(northEast.x).toBeGreaterThan(0);
		expect(northEast.z).toBeLessThan(0);
	});

	it('round-trips between geographic and local coordinates', () => {
		const p = toGeo(toLocal(MONUMENT_COORDINATES.menkaure));
		expect(p.lat).toBeCloseTo(MONUMENT_COORDINATES.menkaure.lat, 9);
		expect(p.lon).toBeCloseTo(MONUMENT_COORDINATES.menkaure.lon, 9);
	});

	it('keeps the known layout of the plateau (Khafre SW of Khufu, Menkaure further SW, Sphinx SE)', () => {
		const khafre = toLocal(MONUMENT_COORDINATES.khafre);
		const menkaure = toLocal(MONUMENT_COORDINATES.menkaure);
		const sphinx = toLocal(MONUMENT_COORDINATES.sphinx);
		expect(Math.hypot(khafre.x, khafre.z)).toBeGreaterThan(450);
		expect(Math.hypot(khafre.x, khafre.z)).toBeLessThan(500);
		expect(menkaure.x).toBeLessThan(khafre.x);
		expect(menkaure.z).toBeGreaterThan(khafre.z);
		expect(sphinx.x).toBeGreaterThan(0);
		expect(sphinx.z).toBeGreaterThan(0);
	});
});
