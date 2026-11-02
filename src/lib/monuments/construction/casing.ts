import { color } from 'three/tsl';
import { ConeGeometry, Mesh, MeshStandardNodeMaterial } from 'three/webgpu';
import { MASONRY_PALETTE } from '../../materials/masonry-palette.ts';

const CASING_OPACITY = 0.28;

export function createCasingGhost(baseSide: number, originalHeight: number): Mesh {
	const geometry = new ConeGeometry(baseSide / Math.SQRT2, originalHeight, 4, 1, true);
	geometry.rotateY(Math.PI / 4);
	geometry.translate(0, originalHeight / 2, 0);
	const material = new MeshStandardNodeMaterial({
		roughness: 0.6,
		metalness: 0,
		transparent: true,
		depthWrite: false,
		opacity: CASING_OPACITY
	});
	material.colorNode = color(MASONRY_PALETTE.tura);
	material.emissiveNode = color(MASONRY_PALETTE.tura).mul(0.25);
	const mesh = new Mesh(geometry, material);
	mesh.name = 'tura-casing';
	mesh.renderOrder = 1;
	mesh.visible = false;
	return mesh;
}

export function disposeCasingGhost(mesh: Mesh): void {
	mesh.geometry.dispose();
	(mesh.material as MeshStandardNodeMaterial).dispose();
}
