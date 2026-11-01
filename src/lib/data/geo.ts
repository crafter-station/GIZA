export interface GeoPoint {
	lat: number;
	lon: number;
}

export interface LocalPoint {
	x: number;
	z: number;
}

export const GIZA_ORIGIN: GeoPoint = { lat: 29 + 58 / 60 + 45 / 3600, lon: 31 + 8 / 60 + 3 / 3600 };

export const MONUMENT_COORDINATES = {
	khufu: GIZA_ORIGIN,
	khafre: { lat: 29 + 58 / 60 + 34 / 3600, lon: 31 + 7 / 60 + 51 / 3600 },
	menkaure: { lat: 29 + 58 / 60 + 21 / 3600, lon: 31 + 7 / 60 + 42 / 3600 },
	sphinx: { lat: 29 + 58 / 60 + 31 / 3600, lon: 31 + 8 / 60 + 15 / 3600 }
} as const satisfies Record<string, GeoPoint>;

export type MonumentId = keyof typeof MONUMENT_COORDINATES;

const DEG = Math.PI / 180;

export function metersPerDegree(latDeg: number): { lat: number; lon: number } {
	const p = latDeg * DEG;
	return {
		lat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p) - 0.0023 * Math.cos(6 * p),
		lon: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p)
	};
}

const SCALE = metersPerDegree(GIZA_ORIGIN.lat);

export function toLocal(point: GeoPoint, origin: GeoPoint = GIZA_ORIGIN): LocalPoint {
	return {
		x: (point.lon - origin.lon) * SCALE.lon,
		z: (origin.lat - point.lat) * SCALE.lat
	};
}

export function toGeo(point: LocalPoint, origin: GeoPoint = GIZA_ORIGIN): GeoPoint {
	return {
		lat: origin.lat - point.z / SCALE.lat,
		lon: origin.lon + point.x / SCALE.lon
	};
}
