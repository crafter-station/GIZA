import { fact } from '../content/sources.ts';

const ARCSEC = Math.PI / (180 * 3600);
const J2000_YEAR = 2000;

export type Vector3Tuple = [number, number, number];

export const ANCIENT_SKY = fact(
	{ year: -2559, label: '2560 BCE', limitingMagnitude: 5.2, poleStar: 'Thuban (α Draconis)' },
	{
		status: 'established',
		sources: ['hoffleitWarren1991', 'capitaine2003'],
		checked: 'computed',
		note: 'Stars of the Yale Bright Star Catalogue moved from J2000 to 2560 BCE with their proper motions and the IAU 2006 (P03) precession. Around then Thuban, not Polaris, stood next to the north celestial pole.'
	}
);

export function unitVector(ra: number, dec: number): Vector3Tuple {
	return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

export function anglesOf([x, y, z]: Vector3Tuple): [number, number] {
	const ra = Math.atan2(y, x);
	return [ra < 0 ? ra + 2 * Math.PI : ra, Math.asin(Math.max(-1, Math.min(1, z)))];
}

export function applyProperMotion(
	ra: number,
	dec: number,
	pmRaCosDec: number,
	pmDec: number,
	years: number
): [number, number] {
	const p = unitVector(ra, dec);
	const east: Vector3Tuple = [-Math.sin(ra), Math.cos(ra), 0];
	const north: Vector3Tuple = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
	const a = pmRaCosDec * ARCSEC * years;
	const d = pmDec * ARCSEC * years;
	const moved = p.map((value, i) => value + east[i] * a + north[i] * d) as Vector3Tuple;
	const length = Math.hypot(...moved);
	return anglesOf(moved.map((value) => value / length) as Vector3Tuple);
}

function rotateZ(v: Vector3Tuple, angle: number): Vector3Tuple {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]];
}

function rotateY(v: Vector3Tuple, angle: number): Vector3Tuple {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
}

export function precessionAngles(year: number): { zeta: number; z: number; theta: number } {
	const t = (year - J2000_YEAR) / 100;
	const poly = (c: readonly number[]) => c.reduce((sum, coefficient, power) => sum + coefficient * t ** power, 0);
	return {
		zeta: poly([2.650545, 2306.083227, 0.2988499, 0.01801828, -0.000005971, -0.0000003173]) * ARCSEC,
		z: poly([-2.650545, 2306.077181, 1.0927348, 0.01826837, -0.000028596, -0.0000002904]) * ARCSEC,
		theta: poly([0, 2004.191903, -0.4294934, -0.04182264, -0.000007089, -0.0000001274]) * ARCSEC
	};
}

export function precessFromJ2000(ra: number, dec: number, year: number): [number, number] {
	const { zeta, z, theta } = precessionAngles(year);
	return anglesOf(rotateZ(rotateY(rotateZ(unitVector(ra, dec), -zeta), theta), -z));
}

export function starAt(ra: number, dec: number, pmRaCosDec: number, pmDec: number, year: number): [number, number] {
	const [movedRa, movedDec] = applyProperMotion(ra, dec, pmRaCosDec, pmDec, year - J2000_YEAR);
	return precessFromJ2000(movedRa, movedDec, year);
}

export function localSiderealAngle(date: Date, longitudeDeg: number): number {
	const days = date.getTime() / 86_400_000 + 2440587.5 - 2451545;
	const degrees = 280.46061837 + 360.98564736629 * days + longitudeDeg;
	return ((((degrees % 360) + 360) % 360) * Math.PI) / 180;
}
