import { color } from 'three/tsl';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import type { InteriorMaterials } from '../monuments/interiors/khufu-interior.ts';
import { MASONRY_PALETTE } from './masonry-palette.ts';

export function createInteriorMaterials(): InteriorMaterials {
	const limestone = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
	limestone.colorNode = color(0xe2cda8);
	limestone.emissiveNode = color(0x6b4520).mul(0.6);
	const granite = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0 });
	granite.colorNode = color(MASONRY_PALETTE.granite);
	granite.emissiveNode = color(0x5a2418).mul(0.6);
	const detected = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
	detected.colorNode = color(0xe8cd86);
	detected.opacity = 0.35;
	return { limestone, granite, detected };
}
