import { BufferGeometry, Float32BufferAttribute, LOD, type Material, Mesh } from 'three/webgpu';
import type { PyramidVolume } from '../../data/layout.ts';
import type { PyramidDesign, PyramidMeshData } from './generator.ts';
import { STONE } from './generator.ts';
import { createPyramidVolumeGeometry } from './volume.ts';

export function geometryFromMeshData(data: PyramidMeshData): BufferGeometry {
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
	geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
	geometry.setAttribute('stone', new Float32BufferAttribute(data.stone, 1));
	geometry.setAttribute('along', new Float32BufferAttribute(data.along, 1));
	geometry.setAttribute('courseV', new Float32BufferAttribute(data.courseV, 1));
	geometry.setAttribute('course', new Float32BufferAttribute(data.course, 1));
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return geometry;
}

export function farGeometry(volume: PyramidVolume): BufferGeometry {
	const geometry = createPyramidVolumeGeometry(volume);
	const position = geometry.getAttribute('position');
	const count = position.count;
	const along = new Float32Array(count);
	for (let i = 0; i < count; i++) along[i] = position.getX(i) + position.getZ(i);
	geometry.setAttribute('stone', new Float32BufferAttribute(new Float32Array(count).fill(STONE.core), 1));
	geometry.setAttribute('along', new Float32BufferAttribute(along, 1));
	geometry.setAttribute('courseV', new Float32BufferAttribute(new Float32Array(count).fill(0.5), 1));
	geometry.setAttribute('course', new Float32BufferAttribute(new Float32Array(count), 1));
	return geometry;
}

export function generateInWorker(designs: readonly PyramidDesign[]): Promise<PyramidMeshData[]> {
	const worker = new Worker(new URL('./pyramid.worker.ts', import.meta.url), { type: 'module' });
	return new Promise<PyramidMeshData[]>((resolve, reject) => {
		worker.onmessage = (event: MessageEvent<PyramidMeshData[]>) => resolve(event.data);
		worker.onerror = (event) => reject(new Error(event.message || 'Pyramid worker failed'));
		worker.postMessage(designs);
	}).finally(() => worker.terminate());
}

export function createPyramidObject(
	name: string,
	detail: BufferGeometry,
	far: BufferGeometry,
	lodDistance: number,
	material: Material
): LOD {
	const lod = new LOD();
	lod.name = name;
	for (const [geometry, distance] of [
		[detail, 0],
		[far, lodDistance]
	] as const) {
		const mesh = new Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		lod.addLevel(mesh, distance);
	}
	return lod;
}
