import { isLightingMode, type LightingMode } from '../world/atmosphere/lighting.ts';
import { isTier, type Tier } from './quality.ts';

export interface Flags {
	backend: 'auto' | 'webgl';
	tier: Tier | null;
	perf: boolean;
	t: number | null;
	cam: readonly [number, number, number, number, number, number, number] | null;
	lighting: LightingMode;
	noAo: boolean;
}

export function parseFlags(search: string): Flags {
	const params = new URLSearchParams(search);
	const tier = params.get('tier');
	const t = Number.parseFloat(params.get('t') ?? '');
	const lighting = params.get('lighting');
	const cam = (params.get('cam') ?? '').split(',').map(Number);
	return {
		backend: params.get('backend') === 'webgl' ? 'webgl' : 'auto',
		tier: isTier(tier) ? tier : null,
		perf: params.has('perf'),
		t: Number.isFinite(t) && t >= 0 ? t : null,
		cam: cam.length === 7 && cam.every(Number.isFinite) ? (cam as unknown as NonNullable<Flags['cam']>) : null,
		lighting: isLightingMode(lighting) ? lighting : 'tour',
		noAo: params.has('noao')
	};
}
