import {
	color,
	float,
	mix,
	mx_noise_float,
	normalWorld,
	oneMinus,
	positionWorld,
	saturate,
	sin,
	smoothstep
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { GROUND_PALETTE } from './ground.ts';

export const ROCK_PALETTE = { light: 0xe0c9a2, dark: 0xbfa278 } as const;

export function createLimestoneMaterial(): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
	const p = positionWorld;
	const grain = mx_noise_float(p.mul(0.9))
		.mul(0.6)
		.add(mx_noise_float(p.mul(3.7)).mul(0.4));
	const strata = sin(p.y.mul((Math.PI * 2) / 0.45).add(mx_noise_float(p.mul(0.2)).mul(3)))
		.mul(0.5)
		.add(0.5);
	const tone = saturate(grain.mul(0.35).add(strata.mul(0.3)).add(0.45));
	const base = mix(color(ROCK_PALETTE.dark), color(ROCK_PALETTE.light), tone);
	const underside = smoothstep(-0.2, 0.6, normalWorld.y);
	const dust = smoothstep(0.55, 0.95, normalWorld.y).mul(0.5);
	material.colorNode = mix(base.mul(mix(float(0.82), float(1), underside)), color(GROUND_PALETTE.sandLight), dust);
	material.roughnessNode = oneMinus(grain.mul(0.05)).mul(0.9);
	return material;
}
