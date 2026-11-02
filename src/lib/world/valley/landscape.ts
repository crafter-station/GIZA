import { mix, positionLocal, positionWorld, smoothstep, time, uniform, vec3 } from 'three/tsl';
import {
	BufferGeometry,
	CanvasTexture,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicNodeMaterial,
	MeshStandardNodeMaterial,
	type Object3D,
	Quaternion,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
	SRGBColorSpace,
	Vector3
} from 'three/webgpu';
import type { Tier } from '#lib/app/quality.ts';
import { canalCenter, valleyPlants } from './placement.ts';

type GroundAt = (x: number, z: number) => number;

function seeded(seed: number): () => number {
	let value = seed >>> 0;
	return () => {
		value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
		return value / 4294967296;
	};
}

function surface(
	x0: number,
	x1: number,
	z0: number,
	z1: number,
	groundAt: GroundAt,
	segmentsX = 24,
	segmentsZ = 48,
	lift = 0.6
): BufferGeometry {
	const positions: number[] = [];
	const indices: number[] = [];
	for (let iz = 0; iz <= segmentsZ; iz++) {
		for (let ix = 0; ix <= segmentsX; ix++) {
			const x = x0 + ((x1 - x0) * ix) / segmentsX;
			const z = z0 + ((z1 - z0) * iz) / segmentsZ;
			positions.push(x, groundAt(x, z) + lift, z);
		}
	}
	for (let iz = 0; iz < segmentsZ; iz++) {
		for (let ix = 0; ix < segmentsX; ix++) {
			const a = iz * (segmentsX + 1) + ix;
			indices.push(a, a + segmentsX + 1, a + 1, a + 1, a + segmentsX + 1, a + segmentsX + 2);
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

function canal(groundAt: GroundAt): BufferGeometry {
	const positions: number[] = [];
	const indices: number[] = [];
	const steps = 68;
	for (let i = 0; i <= steps; i++) {
		const x = 620 + (2720 * i) / steps;
		const center = canalCenter(x);
		const half = 15 + (i / steps) * 30;
		for (const side of [-1, 1]) {
			const z = center + side * half;
			positions.push(x, groundAt(x, z) + 1.2, z);
		}
		if (i < steps) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

function palmFrond(): BufferGeometry {
	const positions: number[] = [];
	const indices: number[] = [];
	for (let i = 0; i <= 10; i++) {
		const t = i / 10;
		const width = 0.1 + 0.65 * Math.sin(t * Math.PI);
		const y = 1.5 * Math.sin(t * Math.PI) - 1.9 * t * t;
		for (const side of [-1, 1]) positions.push(side * width, y, t * 4.8);
		if (i < 10) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

function plantImpostor(): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas 2D is required for distant plants');
	context.fillStyle = '#6d5a32';
	context.fillRect(61, 44, 7, 75);
	context.strokeStyle = '#345c3d';
	context.lineWidth = 7;
	context.lineCap = 'round';
	for (let i = 0; i < 14; i++) {
		const angle = (i / 14) * Math.PI * 2;
		context.beginPath();
		context.moveTo(64, 45);
		context.quadraticCurveTo(
			64 + Math.cos(angle) * 30,
			25 + Math.sin(angle) * 12,
			64 + Math.cos(angle) * 52,
			50 + Math.sin(angle) * 17
		);
		context.stroke();
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

export class ValleyLandscape {
	readonly group = new Group();
	private readonly ancient = new Group();
	private readonly era = uniform(0);
	private readonly materials: (MeshStandardNodeMaterial | MeshBasicNodeMaterial | SpriteMaterial)[] = [];
	private readonly textures: CanvasTexture[] = [];
	private amount = 0;

	constructor(groundAt: GroundAt, tier: Tier) {
		this.group.name = 'valley-landscape';
		this.ancient.name = 'ancient-reconstruction';
		this.group.add(this.ancient);
		const green = new MeshStandardNodeMaterial({ color: 0x547442, roughness: 1, side: DoubleSide });
		const fertile = mix(
			vec3(0.17, 0.29, 0.12),
			vec3(0.25, 0.36, 0.17),
			positionWorld.x.mul(0.017).sin().mul(positionWorld.z.mul(0.012).cos()).mul(0.5).add(0.5)
		);
		green.colorNode = mix(vec3(0.56, 0.39, 0.22), fertile, smoothstep(900, 2400, positionWorld.x).mul(0.8).add(0.08));
		this.materials.push(green);
		const fringe = new Mesh(surface(950, 3500, -2100, 5800, groundAt, 80, 240, 1.2), green);
		fringe.receiveShadow = true;
		fringe.name = 'simplified-nile-green-belt';
		this.group.add(fringe);
		const water = new MeshStandardNodeMaterial({ color: 0x477f87, metalness: 0.08, roughness: 0.25, side: DoubleSide });
		water.colorNode = mix(
			vec3(0.07, 0.18, 0.21),
			vec3(0.2, 0.35, 0.34),
			positionWorld.z.mul(0.035).add(time.mul(0.35)).sin().mul(0.5).add(0.5)
		);
		water.positionNode = positionLocal.add(vec3(0, positionLocal.x.mul(0.13).add(time.mul(0.8)).sin().mul(0.09), 0));
		this.materials.push(water);
		const river = new Mesh(surface(3370, 3830, -2100, 5800, groundAt, 16, 240, 1.5), water);
		river.name = 'simplified-nile-ribbon';
		this.group.add(river);
		const ancientWater = water.clone();
		ancientWater.transparent = true;
		ancientWater.depthWrite = false;
		ancientWater.opacityNode = this.era;
		this.materials.push(ancientWater);
		const channel = new Mesh(canal(groundAt), ancientWater);
		channel.name = 'hypothetical-harbor-channel';
		this.ancient.add(channel);
		const dock = new MeshBasicNodeMaterial({ color: new Color(0xc7aa73), side: DoubleSide });
		dock.transparent = true;
		dock.depthWrite = false;
		dock.opacityNode = this.era;
		this.materials.push(dock);
		const harbor = new Mesh(surface(590, 690, -190, -70, groundAt, 4, 4, 1.5), dock);
		harbor.name = 'interpretive-harbor';
		this.ancient.add(harbor);
		this.createPalms(groundAt, tier);
		this.createAcacias(groundAt, tier);
		this.createReeds(groundAt, tier);
		this.ancient.visible = false;
	}

	setEra(amount: number): void {
		this.amount = Math.min(1, Math.max(0, amount));
		this.era.value = this.amount;
		this.ancient.visible = this.amount > 0.001;
	}

	get progress(): number {
		return this.amount;
	}

	private createPalms(groundAt: GroundAt, tier: Tier): void {
		const sites = valleyPlants(tier === 'low' ? 100 : tier === 'medium' ? 170 : 280, 2589);
		const near = sites.filter((site) => site.x < 2550);
		const far = sites.filter((site) => site.x >= 2550);
		const trunkMaterial = new MeshStandardNodeMaterial({ color: 0x80603a, roughness: 1 });
		trunkMaterial.colorNode = mix(
			vec3(0.31, 0.2, 0.1),
			vec3(0.44, 0.31, 0.17),
			positionLocal.y.mul(11).sin().mul(0.5).add(0.5)
		);
		const leafMaterial = new MeshStandardNodeMaterial({ color: 0x406946, roughness: 0.9, side: DoubleSide });
		leafMaterial.positionNode = positionLocal.add(
			vec3(positionLocal.z.mul(0.8).add(time.mul(1.7)).sin().mul(positionLocal.z).mul(0.025), 0, 0)
		);
		this.materials.push(trunkMaterial, leafMaterial);
		const trunks = new InstancedMesh(new CylinderGeometry(0.27, 0.52, 8, 7, 10), trunkMaterial, near.length);
		const fronds = new InstancedMesh(palmFrond(), leafMaterial, near.length * 10);
		const matrix = new Matrix4();
		const position = new Vector3();
		const quaternion = new Quaternion();
		const scale = new Vector3();
		const next = seeded(9107);
		near.forEach((site, i) => {
			const y = groundAt(site.x, site.z);
			position.set(site.x, y + 4 * site.scale, site.z);
			trunks.setMatrixAt(
				i,
				matrix.compose(position, quaternion.identity(), scale.set(site.scale, site.scale, site.scale))
			);
			for (let f = 0; f < 10; f++) {
				position.set(site.x, y + 8 * site.scale, site.z);
				quaternion.setFromAxisAngle(new Vector3(0, 1, 0), (f * Math.PI * 2) / 10 + next() * 0.2);
				fronds.setMatrixAt(
					i * 10 + f,
					matrix.compose(position, quaternion, scale.setScalar(site.scale * (0.8 + next() * 0.4)))
				);
			}
		});
		trunks.instanceMatrix.needsUpdate = true;
		fronds.instanceMatrix.needsUpdate = true;
		trunks.computeBoundingSphere();
		fronds.computeBoundingSphere();
		trunks.name = 'date-palm-trunks';
		fronds.name = 'date-palm-fronds';
		this.group.add(trunks, fronds);
		const texture = plantImpostor();
		this.textures.push(texture);
		const spriteMaterial = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
		this.materials.push(spriteMaterial);
		for (const site of far) {
			const sprite = new Sprite(spriteMaterial);
			sprite.position.set(site.x, groundAt(site.x, site.z) + 6 * site.scale, site.z);
			sprite.scale.set(12 * site.scale, 13 * site.scale, 1);
			this.group.add(sprite);
		}
	}

	private createAcacias(groundAt: GroundAt, tier: Tier): void {
		const sites = valleyPlants(tier === 'low' ? 36 : tier === 'medium' ? 64 : 108, 3719).map((site) => ({
			...site,
			x: site.x + 220
		}));
		const bark = new MeshStandardNodeMaterial({ color: 0x665436, roughness: 1 });
		const foliage = new MeshStandardNodeMaterial({ color: 0x66794a, roughness: 1 });
		this.materials.push(bark, foliage);
		const trunks = new InstancedMesh(new CylinderGeometry(0.19, 0.36, 5, 6), bark, sites.length);
		const canopies = new InstancedMesh(new SphereGeometry(1, 9, 5), foliage, sites.length * 3);
		const matrix = new Matrix4();
		const position = new Vector3();
		const rotation = new Quaternion();
		const scale = new Vector3();
		sites.forEach((site, i) => {
			const y = groundAt(site.x, site.z);
			trunks.setMatrixAt(
				i,
				matrix.compose(position.set(site.x, y + 2.5 * site.scale, site.z), rotation, scale.setScalar(site.scale))
			);
			for (let c = 0; c < 3; c++) {
				const angle = (c * Math.PI * 2) / 3;
				canopies.setMatrixAt(
					i * 3 + c,
					matrix.compose(
						position.set(
							site.x + Math.cos(angle) * 2 * site.scale,
							y + 5.2 * site.scale,
							site.z + Math.sin(angle) * 2 * site.scale
						),
						rotation,
						scale.set(3.4 * site.scale, 1.3 * site.scale, 2.8 * site.scale)
					)
				);
			}
		});
		trunks.instanceMatrix.needsUpdate = true;
		canopies.instanceMatrix.needsUpdate = true;
		trunks.computeBoundingSphere();
		canopies.computeBoundingSphere();
		trunks.name = 'nile-acacia-trunks';
		canopies.name = 'nile-acacia-canopies';
		this.group.add(trunks, canopies);
	}

	private createReeds(groundAt: GroundAt, tier: Tier): void {
		const count = tier === 'low' ? 300 : tier === 'medium' ? 650 : 1200;
		const stems = new MeshStandardNodeMaterial({ color: 0x657649, roughness: 1, side: DoubleSide });
		const heads = new MeshStandardNodeMaterial({ color: 0x887851, roughness: 1, side: DoubleSide });
		for (const material of [stems, heads]) {
			material.transparent = true;
			material.depthWrite = false;
			material.opacityNode = this.era;
		}
		this.materials.push(stems, heads);
		const stalks = new InstancedMesh(new CylinderGeometry(0.025, 0.045, 2.2, 4), stems, count);
		const umbels = new InstancedMesh(new ConeGeometry(0.28, 0.33, 5), heads, count);
		const matrix = new Matrix4();
		const position = new Vector3();
		const rotation = new Quaternion();
		const scale = new Vector3();
		const next = seeded(431);
		for (let i = 0; i < count; i++) {
			const x = 700 + next() * 2500;
			const z = canalCenter(x) + (next() > 0.5 ? 1 : -1) * (25 + next() * 15);
			const y = groundAt(x, z);
			const height = 0.7 + next() * 0.8;
			stalks.setMatrixAt(i, matrix.compose(position.set(x, y + height * 1.1, z), rotation, scale.setScalar(height)));
			umbels.setMatrixAt(i, matrix.compose(position.set(x, y + height * 2.25, z), rotation, scale.setScalar(height)));
		}
		stalks.instanceMatrix.needsUpdate = true;
		umbels.instanceMatrix.needsUpdate = true;
		stalks.computeBoundingSphere();
		umbels.computeBoundingSphere();
		stalks.name = 'hypothetical-papyrus-reeds';
		umbels.name = 'papyrus-umbels';
		this.ancient.add(stalks, umbels);
	}

	dispose(): void {
		this.group.traverse((object: Object3D) => {
			const mesh = object as Mesh;
			if (mesh.isMesh) mesh.geometry.dispose();
			const instance = object as InstancedMesh;
			if (instance.isInstancedMesh) instance.dispose();
		});
		for (const material of this.materials) material.dispose();
		for (const texture of this.textures) texture.dispose();
		this.group.removeFromParent();
	}
}
