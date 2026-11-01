import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import type { PyramidVolume } from '../../data/layout.ts';

export function createPyramidVolumeGeometry(pyramid: PyramidVolume): BufferGeometry {
	const topScale = 1 - pyramid.currentHeight / pyramid.originalHeight;
	const bx = pyramid.baseX / 2;
	const bz = pyramid.baseZ / 2;
	const tx = bx * topScale;
	const tz = bz * topScale;
	const h = pyramid.currentHeight;
	const base = [
		[-bx, 0, -bz],
		[bx, 0, -bz],
		[bx, 0, bz],
		[-bx, 0, bz]
	];
	const top = [
		[-tx, h, -tz],
		[tx, h, -tz],
		[tx, h, tz],
		[-tx, h, tz]
	];
	const positions: number[] = [];
	const quad = (a: number[], b: number[], c: number[], d: number[]) =>
		positions.push(...a, ...c, ...b, ...a, ...d, ...c);
	for (let i = 0; i < 4; i++) {
		const j = (i + 1) % 4;
		quad(base[i], base[j], top[j], top[i]);
	}
	if (topScale > 0) quad(top[0], top[1], top[2], top[3]);
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
}
