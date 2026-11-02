import { uniform } from 'three/tsl';
import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	InstancedMesh,
	type Material,
	Matrix4,
	type Mesh,
	type MeshStandardNodeMaterial,
	Quaternion,
	Vector3
} from 'three/webgpu';
import { WALL_OF_THE_CROW, WORKERS_TOWN_LAYOUT } from '../../data/workers-town.ts';

type GroundAt = (x: number, z: number) => number;

interface Footprint {
	u: number;
	v: number;
	width: number;
	depth: number;
	height: number;
}

const WALL = WALL_OF_THE_CROW.value;
const LAYOUT = WORKERS_TOWN_LAYOUT.value;
const WALL_SEGMENT = 20;
const WALL_BATTER = 0.3;
const WALL_SINK = 1;
const ENCLOSURE = { u: -12, from: 0, to: 250, thickness: 2.5, height: 4 } as const;
const GALLERY_SETS: readonly { u: number; v: number; count: number }[] = [
	{ u: 18, v: 30, count: 10 },
	{ u: 92, v: 30, count: 10 },
	{ u: 158, v: 30, count: 9 },
	{ u: 92, v: 95, count: 10 }
];
const ADMINISTRATION = { u0: 225, u1: 285, v0: 30, v1: 95, wall: 2, height: 4 } as const;
const BAKERIES = { count: 6, u0: 20, u1: 140, v: 148, width: 5, depth: 6, height: 2.5 } as const;
const TOWNS: readonly { count: number; u: readonly [number, number]; v: readonly [number, number]; seed: number }[] = [
	{ count: 22, u: [-80, -20], v: [15, 180], seed: 11 },
	{ count: 28, u: [220, 310], v: [110, 240], seed: 29 }
];
const SINK = 0.3;
const SEGMENT_OVERLAP = 0.25;

function wallSectionGeometry(batter: number): BoxGeometry {
	const geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
	const position = geometry.getAttribute('position');
	for (let i = 0; i < position.count; i++) {
		if (position.getY(i) > 0) position.setZ(i, position.getZ(i) * (1 - batter));
	}
	position.needsUpdate = true;
	geometry.computeVertexNormals();
	return geometry;
}

function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function enclosureOf(u0: number, u1: number, v0: number, v1: number, wall: number, height: number): Footprint[] {
	const u = (u0 + u1) / 2;
	const v = (v0 + v1) / 2;
	return [
		{ u, v: v0, width: u1 - u0, depth: wall, height },
		{ u, v: v1, width: u1 - u0, depth: wall, height },
		{ u: u0, v, width: wall, depth: v1 - v0, height },
		{ u: u1, v, width: wall, depth: v1 - v0, height }
	];
}

export function townFootprints(): { buildings: Footprint[]; silos: Footprint[] } {
	const { gallery, silo, houses } = LAYOUT;
	const buildings: Footprint[] = [
		{
			u: ENCLOSURE.u,
			v: (ENCLOSURE.from + ENCLOSURE.to) / 2,
			width: ENCLOSURE.thickness,
			depth: ENCLOSURE.to - ENCLOSURE.from,
			height: ENCLOSURE.height
		}
	];
	for (const set of GALLERY_SETS) {
		for (let i = 0; i < set.count; i++) {
			buildings.push({
				u: set.u + i * gallery.pitch + gallery.width / 2,
				v: set.v + gallery.length / 2,
				width: gallery.width,
				depth: gallery.length,
				height: gallery.height
			});
		}
	}
	const a = ADMINISTRATION;
	buildings.push(...enclosureOf(a.u0, a.u1, a.v0, a.v1, a.wall, a.height));
	const step = (BAKERIES.u1 - BAKERIES.u0) / (BAKERIES.count - 1);
	for (let i = 0; i < BAKERIES.count; i++) {
		buildings.push({
			u: BAKERIES.u0 + i * step,
			v: BAKERIES.v,
			width: BAKERIES.width,
			depth: BAKERIES.depth,
			height: BAKERIES.height
		});
	}
	for (const town of TOWNS) {
		const next = random(town.seed);
		for (let i = 0; i < town.count; i++) {
			const size = () => houses.size[0] + next() * (houses.size[1] - houses.size[0]);
			buildings.push({
				u: town.u[0] + next() * (town.u[1] - town.u[0]),
				v: town.v[0] + next() * (town.v[1] - town.v[0]),
				width: size(),
				depth: size(),
				height: houses.height * (0.8 + next() * 0.4)
			});
		}
	}
	const silos: Footprint[] = [];
	for (let row = 0; row < 2; row++) {
		for (let i = 0; i < 5; i++) {
			silos.push({
				u: a.u0 + 8 + i * 11,
				v: a.v0 + 20 + row * 22,
				width: silo.diameter,
				depth: silo.diameter,
				height: silo.height
			});
		}
	}
	return { buildings, silos };
}

export class WorkersTown {
	readonly wall = new Group();
	readonly town = new Group();
	private readonly amount = uniform(0);
	private readonly origin: Vector3;
	private readonly along: Vector3;
	private readonly across: Vector3;
	private readonly rotation = new Quaternion();

	constructor(
		private readonly groundAt: GroundAt,
		wallMaterial: Material,
		private readonly townMaterial: MeshStandardNodeMaterial
	) {
		this.wall.name = 'wall-of-the-crow';
		this.town.name = 'workers-town-reconstruction';
		this.origin = new Vector3(LAYOUT.wallWest.x, 0, LAYOUT.wallWest.z);
		const east = new Vector3(LAYOUT.wallEast.x, 0, LAYOUT.wallEast.z);
		this.along = east.clone().sub(this.origin).normalize();
		this.across = new Vector3(-this.along.z, 0, this.along.x);
		this.rotation.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-this.along.z, this.along.x));
		this.buildWall(wallMaterial);
		this.townMaterial.transparent = true;
		this.townMaterial.depthWrite = false;
		this.townMaterial.opacityNode = this.amount;
		const { buildings, silos } = townFootprints();
		this.town.add(this.instanced(new BoxGeometry(1, 1, 1), buildings, 'workers-town-buildings'));
		this.town.add(this.instanced(new CylinderGeometry(0.5, 0.5, 1, 14), silos, 'workers-town-silos'));
		this.town.visible = false;
	}

	world(u: number, v: number): Vector3 {
		return this.origin.clone().addScaledVector(this.along, u).addScaledVector(this.across, v);
	}

	private instanced(
		geometry: BoxGeometry | CylinderGeometry,
		footprints: readonly Footprint[],
		name: string
	): InstancedMesh {
		const mesh = new InstancedMesh(geometry, this.townMaterial, footprints.length);
		const matrix = new Matrix4();
		const scale = new Vector3();
		footprints.forEach((footprint, index) => {
			const position = this.world(footprint.u, footprint.v);
			position.y = this.groundAt(position.x, position.z) + footprint.height / 2 - SINK;
			scale.set(footprint.width, footprint.height, footprint.depth);
			mesh.setMatrixAt(index, matrix.compose(position, this.rotation, scale));
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.name = name;
		mesh.receiveShadow = true;
		return mesh;
	}

	private buildWall(material: Material): void {
		const length = this.origin.distanceTo(new Vector3(LAYOUT.wallEast.x, 0, LAYOUT.wallEast.z));
		const gateCentre = length * LAYOUT.gateAlong;
		const gateStart = gateCentre - WALL.gate.width / 2;
		const gateEnd = gateCentre + WALL.gate.width / 2;
		const geometry = wallSectionGeometry(WALL_BATTER);
		const pieces: { from: number; to: number; bottom: number }[] = [];
		const span = (from: number, to: number, bottom: number) => {
			for (let start = from; start < to - 0.01; start += WALL_SEGMENT) {
				pieces.push({ from: start, to: Math.min(start + WALL_SEGMENT, to), bottom });
			}
		};
		span(0, gateStart, 0);
		span(gateEnd, length, 0);
		pieces.push({ from: gateStart, to: gateEnd, bottom: WALL.gate.height });
		const matrix = new Matrix4();
		const scale = new Vector3();
		const mesh = new InstancedMesh(geometry, material, pieces.length);
		pieces.forEach((piece, index) => {
			const centre = this.world((piece.from + piece.to) / 2, 0);
			const ends = [this.world(piece.from, 0), this.world(piece.to, 0)];
			const ground = Math.min(...ends.map((end) => this.groundAt(end.x, end.z)), this.groundAt(centre.x, centre.z));
			const base = ground - WALL_SINK + piece.bottom;
			const height = WALL.height + WALL_SINK - piece.bottom;
			centre.y = base + height / 2;
			scale.set(piece.to - piece.from + SEGMENT_OVERLAP, height, WALL.baseThickness);
			mesh.setMatrixAt(index, matrix.compose(centre, this.rotation, scale));
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		this.wall.add(mesh);
	}

	gate(): Vector3 {
		const length = this.origin.distanceTo(new Vector3(LAYOUT.wallEast.x, 0, LAYOUT.wallEast.z));
		const gate = this.world(length * LAYOUT.gateAlong, 0);
		gate.y = this.groundAt(gate.x, gate.z);
		return gate;
	}

	setEra(amount: number): void {
		this.amount.value = Math.max(0, Math.min(1, amount));
		this.town.visible = this.amount.value > 0.001;
	}

	dispose(): void {
		for (const group of [this.wall, this.town]) {
			group.traverse((object) => {
				const mesh = object as Mesh;
				if (mesh.isMesh) mesh.geometry.dispose();
				const instance = object as InstancedMesh;
				if (instance.isInstancedMesh) instance.dispose();
			});
			group.removeFromParent();
		}
	}
}
