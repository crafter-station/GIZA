import { generatePyramid, type PyramidDesign, type PyramidMeshData } from './generator.ts';

self.onmessage = (event: MessageEvent<readonly PyramidDesign[]>) => {
	const meshes: PyramidMeshData[] = event.data.map((design) => generatePyramid(design));
	const transfer = meshes.flatMap((mesh) => [
		mesh.positions.buffer,
		mesh.normals.buffer,
		mesh.stone.buffer,
		mesh.along.buffer,
		mesh.courseV.buffer,
		mesh.course.buffer
	]);
	self.postMessage(meshes, { transfer });
};
