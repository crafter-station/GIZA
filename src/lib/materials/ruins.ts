import { color, mix, mx_noise_float, positionWorld, saturate, smoothstep } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { MASONRY_PALETTE } from './masonry.ts';

export function createBasaltMaterial(): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0 });
	const grain = mx_noise_float(positionWorld.mul(1.7)).mul(0.5).add(0.5);
	material.colorNode = mix(color(0x2b2a29), color(0x4a4643), saturate(grain));
	return material;
}

export function createGraniteMaterial(): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: 0.6, metalness: 0 });
	const p = positionWorld;
	const speckle = mx_noise_float(p.mul(9));
	const weathering = saturate(mx_noise_float(p.mul(0.35)).mul(0.5).add(0.35));
	material.colorNode = mix(
		mix(color(MASONRY_PALETTE.granite), color(MASONRY_PALETTE.graniteWeathered), weathering),
		color(MASONRY_PALETTE.graniteDark),
		smoothstep(0.35, 0.6, speckle)
	);
	return material;
}

export function createPitMaterial(): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
	material.colorNode = mix(color(0x4a3a28), color(0x6b553b), saturate(mx_noise_float(positionWorld.mul(0.6)).add(0.5)));
	return material;
}
