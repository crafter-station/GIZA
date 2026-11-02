import { getMoonPosition, getPosition } from 'suncalc';
import { GIZA_ORIGIN } from '../../data/geo.ts';

export const LIGHTING_MODES = ['tour', 'dawn', 'noon', 'sunset', 'night'] as const;
export type LightingMode = (typeof LIGHTING_MODES)[number];
export type LightingPreset = Exclude<LightingMode, 'tour'>;

export const LIGHTING_OPTIONS = [
	{ value: 'tour', label: 'Follow the journey' },
	{ value: 'dawn', label: 'Dawn' },
	{ value: 'noon', label: 'Midday' },
	{ value: 'sunset', label: 'Sunset' },
	{ value: 'night', label: 'Moonlit night' }
] as const;

export interface LightingLook {
	hour: number;
	exposure: number;
	skyRadiance: number;
	turbidity: number;
	mie: number;
	fogDensity: number;
	fogColor: number;
	sunColor: number;
	sunIntensity: number;
	hemisphereIntensity: number;
	environmentIntensity: number;
	night: number;
	warmth: number;
	saturation: number;
	rayStrength: number;
	haze: number;
	heat: number;
}

export const LIGHTING_LOOKS: Record<LightingPreset, LightingLook> = {
	dawn: {
		hour: 4.7,
		exposure: 0.72,
		skyRadiance: 2.8,
		turbidity: 5.5,
		mie: 0.008,
		fogDensity: 0.00024,
		fogColor: 0xd2a57e,
		sunColor: 0xffc28a,
		sunIntensity: 1.8,
		hemisphereIntensity: 0.3,
		environmentIntensity: 0.35,
		night: 0,
		warmth: 0.06,
		saturation: 1.22,
		rayStrength: 0.12,
		haze: 0.35,
		heat: 0.15
	},
	noon: {
		hour: 10.12,
		exposure: 0.9,
		skyRadiance: 0.16,
		turbidity: 7,
		mie: 0.004,
		fogDensity: 0.00012,
		fogColor: 0xd8c6a6,
		sunColor: 0xfff2df,
		sunIntensity: 3.4,
		hemisphereIntensity: 0.4,
		environmentIntensity: 0.45,
		night: 0,
		warmth: 0,
		saturation: 1.32,
		rayStrength: 0.018,
		haze: 0.5,
		heat: 1
	},
	sunset: {
		hour: 15.65,
		exposure: 0.66,
		skyRadiance: 4,
		turbidity: 6,
		mie: 0.01,
		fogDensity: 0.00028,
		fogColor: 0xcf9a74,
		sunColor: 0xffb17a,
		sunIntensity: 1.6,
		hemisphereIntensity: 0.22,
		environmentIntensity: 0.3,
		night: 0,
		warmth: 0.045,
		saturation: 1.2,
		rayStrength: 0.1,
		haze: 0.3,
		heat: 0.35
	},
	night: {
		hour: 19,
		exposure: 1.25,
		skyRadiance: 1,
		turbidity: 2,
		mie: 0.004,
		fogDensity: 0.00016,
		fogColor: 0x182334,
		sunColor: 0xb4c9e3,
		sunIntensity: 0,
		hemisphereIntensity: 0.06,
		environmentIntensity: 0.035,
		night: 1,
		warmth: -0.025,
		saturation: 0.72,
		rayStrength: 0,
		haze: 0,
		heat: 0
	}
};

const TRACK: readonly { t: number; look: LightingPreset; exposure?: number }[] = [
	{ t: 0, look: 'dawn' },
	{ t: 0.8, look: 'dawn' },
	{ t: 1.6, look: 'noon' },
	{ t: 2.8, look: 'noon' },
	{ t: 3.5, look: 'noon', exposure: 1.1 },
	{ t: 4.6, look: 'noon', exposure: 0.95 },
	{ t: 5.4, look: 'sunset' },
	{ t: 5.8, look: 'sunset' },
	{ t: 6.8, look: 'noon' },
	{ t: 7.7, look: 'noon' },
	{ t: 8.35, look: 'night' },
	{ t: 8.8, look: 'night' },
	{ t: 9.5, look: 'sunset' },
	{ t: 10.5, look: 'noon' },
	{ t: 11, look: 'noon' }
];

const COLOR_KEYS = new Set<keyof LightingLook>(['fogColor', 'sunColor']);
const LOOK_KEYS = Object.keys(LIGHTING_LOOKS.dawn) as (keyof LightingLook)[];
const DEG = Math.PI / 180;

export const LIGHTING_PRESETS = Object.keys(LIGHTING_LOOKS) as LightingPreset[];

export function nearestPreset(look: LightingLook): LightingPreset {
	if (look.night > 0.5) return 'night';
	let best: LightingPreset = 'noon';
	let distance = Number.POSITIVE_INFINITY;
	for (const preset of LIGHTING_PRESETS) {
		if (preset === 'night') continue;
		const gap = Math.abs(LIGHTING_LOOKS[preset].hour - look.hour);
		if (gap < distance) {
			distance = gap;
			best = preset;
		}
	}
	return best;
}

export function isLightingMode(value: string | null): value is LightingMode {
	return LIGHTING_MODES.includes(value as LightingMode);
}

export function mixRgb(a: number, b: number, weight: number): number {
	let result = 0;
	for (const shift of [16, 8, 0]) {
		const left = (a >> shift) & 255;
		const right = (b >> shift) & 255;
		result |= Math.round(left + (right - left) * weight) << shift;
	}
	return result;
}

export function sampleLighting(t: number, mode: LightingMode, out: LightingLook): LightingLook {
	if (mode !== 'tour') return Object.assign(out, LIGHTING_LOOKS[mode]);
	const time = Number.isFinite(t) ? Math.min(Math.max(t, 0), TRACK[TRACK.length - 1].t) : 0;
	let index = 0;
	while (index < TRACK.length - 2 && TRACK[index + 1].t <= time) index++;
	const a = TRACK[index];
	const b = TRACK[index + 1];
	const progress = Math.min(Math.max((time - a.t) / (b.t - a.t), 0), 1);
	const weight = progress * progress * (3 - 2 * progress);
	const left = LIGHTING_LOOKS[a.look];
	const right = LIGHTING_LOOKS[b.look];
	for (const key of LOOK_KEYS) {
		out[key] = COLOR_KEYS.has(key)
			? mixRgb(left[key], right[key], weight)
			: left[key] + (right[key] - left[key]) * weight;
	}
	out.exposure =
		(a.exposure ?? left.exposure) + ((b.exposure ?? right.exposure) - (a.exposure ?? left.exposure)) * weight;
	return out;
}

export function directionFromAngles(altitude: number, azimuth: number): [number, number, number] {
	const elevation = altitude * DEG;
	const bearing = azimuth * DEG;
	return [Math.sin(bearing) * Math.cos(elevation), Math.sin(elevation), -Math.cos(bearing) * Math.cos(elevation)];
}

export function celestialState(hour: number) {
	const date = new Date(Date.UTC(2026, 2, 3, 0, Math.round(hour * 60)));
	const sun = getPosition(date, GIZA_ORIGIN.lat, GIZA_ORIGIN.lon);
	const moon = getMoonPosition(date, GIZA_ORIGIN.lat, GIZA_ORIGIN.lon);
	return {
		date,
		sun,
		moon,
		sunDirection: directionFromAngles(sun.altitude, sun.azimuth),
		moonDirection: directionFromAngles(moon.altitude, moon.azimuth)
	};
}
