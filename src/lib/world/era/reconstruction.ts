import { mix, positionWorld, uniform, vec3 } from 'three/tsl';
import {
	BoxGeometry,
	DoubleSide,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardNodeMaterial,
	Quaternion,
	Vector3
} from 'three/webgpu';
import { type PyramidVolume, SPHINX_PLACEMENT } from '#lib/data/layout.ts';
import {
	ESTIMATED_HEIGHTS,
	PLAN_FEATURES,
	type PlanRectangle,
	WRITTEN_FEATURES
} from '#lib/monuments/complex/plan-features.ts';
import { createPyramidVolumeGeometry } from '#lib/monuments/pyramid/volume.ts';

type GroundAt = (x: number, z: number) => number;

function enclosure(
	rectangle: PlanRectangle,
	height: number
): { x: number; z: number; width: number; depth: number; height: number }[] {
	const thickness = 3.5;
	const centerX = (rectangle.minX + rectangle.maxX) / 2;
	const centerZ = (rectangle.minZ + rectangle.maxZ) / 2;
	const width = rectangle.maxX - rectangle.minX;
	const depth = rectangle.maxZ - rectangle.minZ;
	return [
		{ x: centerX, z: rectangle.minZ, width, depth: thickness, height },
		{ x: centerX, z: rectangle.maxZ, width, depth: thickness, height },
		{ x: rectangle.minX, z: centerZ, width: thickness, depth, height },
		{ x: rectangle.maxX, z: centerZ, width: thickness, depth, height }
	];
}

export class AncientReconstruction {
	readonly group = new Group();
	private readonly amount = uniform(0);
	private readonly casing: MeshStandardNodeMaterial;
	private readonly temple: MeshStandardNodeMaterial;

	constructor(pyramids: readonly PyramidVolume[], platformOf: (id: string) => number, groundAt: GroundAt) {
		this.group.name = 'interpretive-reconstruction';
		this.casing = new MeshStandardNodeMaterial({ color: 0xede6d6, roughness: 0.56, side: DoubleSide });
		this.casing.colorNode = mix(
			vec3(0.86, 0.81, 0.7),
			vec3(0.96, 0.92, 0.83),
			positionWorld.y.mul(0.006).sin().mul(0.5).add(0.5)
		);
		this.casing.transparent = true;
		this.casing.depthWrite = false;
		this.casing.opacityNode = this.amount;
		for (const pyramid of pyramids) {
			const geometry = createPyramidVolumeGeometry({
				...pyramid,
				baseX: pyramid.baseX + 1.2,
				baseZ: pyramid.baseZ + 1.2,
				currentHeight: pyramid.originalHeight + 0.2,
				originalHeight: pyramid.originalHeight + 0.2
			});
			const shell = new Mesh(geometry, this.casing);
			shell.name = `reconstructed-${pyramid.id}-tura-casing`;
			shell.position.set(pyramid.x, platformOf(pyramid.id) + 0.1, pyramid.z);
			shell.receiveShadow = true;
			this.group.add(shell);
		}
		this.temple = new MeshStandardNodeMaterial({ color: 0xcfb88b, roughness: 0.92 });
		this.temple.transparent = true;
		this.temple.depthWrite = false;
		this.temple.opacityNode = this.amount;
		const plan = PLAN_FEATURES.value;
		const heights = ESTIMATED_HEIGHTS.value;
		const valley = WRITTEN_FEATURES.value.khafreValleyTempleFromSphinx;
		const blocks = [
			...enclosure(
				{
					minX: plan.khufuTemple.x - 22,
					maxX: plan.khufuTemple.x + 22,
					minZ: plan.khufuTemple.z - 28,
					maxZ: plan.khufuTemple.z + 28
				},
				heights.templeWall
			),
			...enclosure(plan.khafreTemple, heights.templeWall),
			...enclosure(plan.menkaureTemple, heights.templeWall),
			...enclosure(
				{
					minX: SPHINX_PLACEMENT.x + valley.x - 22,
					maxX: SPHINX_PLACEMENT.x + valley.x + 22,
					minZ: SPHINX_PLACEMENT.z + valley.z - 22,
					maxZ: SPHINX_PLACEMENT.z + valley.z + 22
				},
				heights.valleyTempleWall
			)
		];
		const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.temple, blocks.length);
		const matrix = new Matrix4();
		const rotation = new Quaternion();
		const position = new Vector3();
		const scale = new Vector3();
		blocks.forEach((block, index) => {
			position.set(block.x, groundAt(block.x, block.z) + block.height / 2, block.z);
			scale.set(block.width, block.height, block.depth);
			mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.name = 'reconstructed-temple-enclosures';
		this.group.add(mesh);
		this.group.visible = false;
	}

	setEra(progress: number): void {
		this.amount.value = Math.max(0, Math.min(1, progress));
		this.group.visible = this.amount.value > 0.001;
	}

	dispose(): void {
		this.group.traverse((object) => {
			const mesh = object as Mesh;
			if (mesh.isMesh) mesh.geometry.dispose();
			const instance = object as InstancedMesh;
			if (instance.isInstancedMesh) instance.dispose();
		});
		this.casing.dispose();
		this.temple.dispose();
		this.group.removeFromParent();
	}
}
