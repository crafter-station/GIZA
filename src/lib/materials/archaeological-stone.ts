import {
	attribute,
	cameraPosition,
	color,
	distance,
	float,
	mix,
	mx_noise_float,
	normalWorld,
	oneMinus,
	positionWorld,
	saturate,
	smoothstep
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { cloudShadow } from '#lib/world/atmosphere/clouds.ts';
import { surfaceGradientNormal } from './stone-detail.ts';

export function createArchaeologicalStoneMaterial(kind: 'basalt' | 'limestone'): MeshStandardNodeMaterial {
	const basalt = kind === 'basalt';
	const material = new MeshStandardNodeMaterial({ roughness: basalt ? 0.8 : 0.94, metalness: 0 });
	material.name = `archaeological-${kind}`;
	const p = positionWorld;
	const tone = attribute('stoneTone', 'float');
	const wear = attribute('stoneWear', 'float');
	const near = oneMinus(smoothstep(35, 130, distance(cameraPosition, p)));
	const grain = mx_noise_float(p.mul(basalt ? 5.5 : 3.2));
	const mottling = mx_noise_float(p.mul(0.65));
	const base = mix(
		color(basalt ? 0x282a2b : 0xa28b68),
		color(basalt ? 0x565552 : 0xdac49e),
		saturate(
			tone
				.mul(0.65)
				.add(mottling.mul(basalt ? 0.08 : 0.18))
				.add(0.16)
		)
	);
	const upward = smoothstep(0.35, 0.92, normalWorld.y);
	const dust = upward.mul(
		saturate(mottling.add(0.25))
			.mul(basalt ? 0.08 : 0.2)
			.add(wear.mul(0.12))
	);
	const worn = mix(base, color(basalt ? 0x918575 : 0xe1cdac), wear.mul(0.17));
	material.colorNode = mix(worn, color(0xc7ac7b), dust).mul(cloudShadow(p));
	material.roughnessNode = mix(float(basalt ? 0.72 : 0.88), float(1), saturate(dust.add(wear.mul(0.25))));
	material.normalNode = surfaceGradientNormal(grain.mul(basalt ? 0.008 : 0.025).mul(near));
	return material;
}
