import {
	BufferGeometry,
	Euler,
	Float32BufferAttribute,
	Group,
	InstancedMesh,
	LOD,
	type Material,
	Matrix4,
	Quaternion,
	Vector3
} from 'three/webgpu';
import { createKhufuTemple, disposeKhufuTemple } from './khufu-temple.ts';
import type { ComplexLayout, RuinBlock, RuinMaterial } from './layout.ts';

const CAUSEWAY_STEP = 12;
const CAUSEWAY_HEIGHT = 1.4;
const SINK = 0.6;

export function createBatteredBoxGeometry(batter: number): BufferGeometry {
	const top = 0.5 * (1 - batter);
	const corners = [
		[-0.5, 0, -0.5],
		[0.5, 0, -0.5],
		[0.5, 0, 0.5],
		[-0.5, 0, 0.5],
		[-top, 1, -top],
		[top, 1, -top],
		[top, 1, top],
		[-top, 1, top]
	];
	const faces = [
		[0, 1, 5, 4],
		[1, 2, 6, 5],
		[2, 3, 7, 6],
		[3, 0, 4, 7],
		[4, 5, 6, 7]
	];
	const positions: number[] = [];
	for (const [a, b, c, d] of faces) {
		for (const index of [a, c, b, a, d, c]) positions.push(...corners[index]);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	return geometry;
}

export function causewayBlocks(
	layout: ComplexLayout,
	groundAt: (x: number, z: number) => number
): (RuinBlock & { y: number })[] {
	return layout.causeways.flatMap((causeway) =>
		causeway.points.slice(1).flatMap((to, index) => {
			const from = causeway.points[index];
			const dx = to.x - from.x;
			const dz = to.z - from.z;
			const length = Math.hypot(dx, dz);
			const count = Math.ceil(length / CAUSEWAY_STEP);
			const rotation = Math.atan2(dx, dz);
			return Array.from({ length: count }, (_, i) => {
				const t = (i + 0.5) / count;
				const x = from.x + dx * t;
				const z = from.z + dz * t;
				return {
					x,
					z,
					y: groundAt(x, z),
					width: causeway.width,
					depth: length / count + 0.2,
					height: CAUSEWAY_HEIGHT,
					rotation,
					material: 'limestone' as const,
					batter: 0,
					source: causeway.source
				};
			});
		})
	);
}

export function createComplex(
	layout: ComplexLayout,
	groundAt: (x: number, z: number) => number,
	materials: Record<RuinMaterial, Material>
): Group {
	const group = new Group();
	group.name = 'complex';
	const placed = [
		...layout.blocks
			.filter((block) => block.sector !== 'khufu-temple')
			.map((block) => ({ ...block, y: groundAt(block.x, block.z) })),
		...causewayBlocks(layout, groundAt)
	];
	const templeBlocks = layout.blocks.filter((block) => block.sector === 'khufu-temple');
	if (templeBlocks.length) group.add(createKhufuTemple(templeBlocks, groundAt));
	const buckets = new Map<string, typeof placed>();
	for (const block of placed) {
		const key = `${block.material}:${block.batter}`;
		buckets.set(key, [...(buckets.get(key) ?? []), block]);
	}
	const matrix = new Matrix4();
	const rotation = new Quaternion();
	const euler = new Euler();
	const position = new Vector3();
	const scale = new Vector3();
	for (const [key, blocks] of buckets) {
		const [material, batter] = key.split(':');
		const mesh = new InstancedMesh(
			createBatteredBoxGeometry(Number(batter)),
			materials[material as RuinMaterial],
			blocks.length
		);
		mesh.name = `complex-${key}`;
		blocks.forEach((block, i) => {
			position.set(block.x, block.y - SINK, block.z);
			rotation.setFromEuler(euler.set(0, block.rotation, 0));
			scale.set(block.width, block.height + SINK, block.depth);
			mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
	}
	return group;
}

export function disposeComplex(group: Group): void {
	const temple = group.getObjectByName('khufu-temple-sector');
	if (temple instanceof LOD) disposeKhufuTemple(temple);
	group.traverse((object) => {
		const mesh = object as InstancedMesh;
		if (mesh.isInstancedMesh) {
			mesh.geometry.dispose();
			mesh.dispose();
		}
	});
}
