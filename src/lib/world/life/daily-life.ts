import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	type Bone,
	BoxGeometry,
	type BufferGeometry,
	Frustum,
	Group,
	LatheGeometry,
	Matrix4,
	Mesh,
	MeshStandardNodeMaterial,
	type PerspectiveCamera,
	type SkinnedMesh,
	Sphere,
	SphereGeometry,
	Vector2,
	Vector3
} from 'three/webgpu';
import type { Tier } from '#lib/app/quality.ts';
import { DAILY_LIFE_SITE } from '#lib/data/daily-life.ts';
import { createPerson, createPersonGeometry, createPersonMaterial, type PersonRig } from './person-model.ts';

type Task = 'grind' | 'knead' | 'carry' | 'rest';

interface Resident {
	mesh: SkinnedMesh;
	rig: PersonRig;
	task: Task;
	x: number;
	z: number;
	phase: number;
	props: Group;
}

const ACTORS: readonly { x: number; z: number; task: Task }[] = [
	{ x: -3, z: 0, task: 'grind' },
	{ x: 0, z: 0.3, task: 'knead' },
	{ x: 4, z: 3.8, task: 'carry' },
	{ x: 2, z: -2.8, task: 'rest' },
	{ x: -3.4, z: -3.4, task: 'grind' },
	{ x: 0.2, z: -3.8, task: 'knead' },
	{ x: 7.5, z: -1.8, task: 'carry' },
	{ x: 3.1, z: -2.3, task: 'rest' }
];
const COUNTS: Record<Tier, number> = { low: 3, medium: 5, high: 8, ultra: 8 };
const COS = Math.cos(DAILY_LIFE_SITE.rotation);
const SIN = Math.sin(DAILY_LIFE_SITE.rotation);
const SIDES = [true, false] as const;

function vessel(): LatheGeometry {
	return new LatheGeometry(
		[
			new Vector2(0.07, 0),
			new Vector2(0.14, 0.03),
			new Vector2(0.2, 0.22),
			new Vector2(0.17, 0.38),
			new Vector2(0.085, 0.47),
			new Vector2(0.09, 0.52),
			new Vector2(0.065, 0.52),
			new Vector2(0.062, 0.47),
			new Vector2(0.13, 0.37),
			new Vector2(0.15, 0.22),
			new Vector2(0.09, 0.06),
			new Vector2(0, 0.06)
		],
		20
	);
}

function bendLimb(
	upperBone: Bone,
	lowerBone: Bone,
	y: number,
	z: number,
	upper: number,
	lower: number,
	bend: number
): void {
	const distance = Math.min(upper + lower - 0.001, Math.max(0.02, Math.hypot(y, z)));
	const axis = Math.atan2(-z, -y);
	const shoulder = Math.acos(
		Math.max(-1, Math.min(1, (upper * upper + distance * distance - lower * lower) / (2 * upper * distance)))
	);
	const elbow =
		Math.PI -
		Math.acos(Math.max(-1, Math.min(1, (upper * upper + lower * lower - distance * distance) / (2 * upper * lower))));
	upperBone.rotation.x = axis - bend * shoulder;
	lowerBone.rotation.x = bend * elbow;
}

export class DailyLife {
	readonly group = new Group();
	private readonly geometry = createPersonGeometry();
	private readonly skins = [0x9a6545, 0x795038, 0xb07b55].map(createPersonMaterial);
	private readonly clay = new MeshStandardNodeMaterial({ color: 0x9e6444, roughness: 0.94 });
	private readonly stone = new MeshStandardNodeMaterial({ color: 0x9c9079, roughness: 1 });
	private readonly wood = new MeshStandardNodeMaterial({ color: 0x776044, roughness: 0.95 });
	private readonly grain = new MeshStandardNodeMaterial({ color: 0xcdb17b, roughness: 1 });
	private readonly jar = vessel();
	private readonly handstone = new SphereGeometry(1, 14, 8).scale(0.27, 0.05, 0.07);
	private readonly residents: Resident[] = [];
	private readonly target = new Vector3();
	private readonly frustum = new Frustum();
	private readonly viewProjection = new Matrix4();
	private readonly bounds = new Sphere(new Vector3(), 15);
	private elapsed = 0;
	private sampledAt = -1;
	private readonly elevation: number;
	private readonly motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

	constructor(private readonly groundAt: (x: number, z: number) => number) {
		this.elevation = groundAt(DAILY_LIFE_SITE.x, DAILY_LIFE_SITE.z);
		this.group.name = 'daily-life-reconstruction';
		this.group.position.set(DAILY_LIFE_SITE.x, this.elevation, DAILY_LIFE_SITE.z);
		this.group.rotation.y = DAILY_LIFE_SITE.rotation;
		this.bounds.center.copy(this.group.position);
		ACTORS.forEach((actor, i) => {
			const { mesh, rig } = createPerson(this.geometry, this.skins[i % this.skins.length]);
			mesh.position.set(actor.x, this.heightAt(actor.x, actor.z), actor.z);
			const props = this.workplace(actor.task);
			props.position.copy(mesh.position);
			this.group.add(mesh, props);
			if (actor.task === 'carry') {
				const jar = new Mesh(this.jar, this.clay);
				jar.position.set(0, -0.16, 0.3);
				jar.castShadow = true;
				rig.spine.add(jar);
			}
			if (actor.task === 'grind') {
				const stone = new Mesh(this.handstone, this.stone);
				stone.position.set(-0.225, -0.32, 0.015);
				stone.castShadow = true;
				rig.leftElbow.add(stone);
			}
			this.residents.push({ mesh, rig, props, ...actor, phase: i * 1.73 });
		});
		this.group.updateMatrixWorld(true);
		for (const resident of this.residents) this.pose(resident, 0);
		this.group.visible = false;
	}

	private heightAt(x: number, z: number): number {
		return this.groundAt(DAILY_LIFE_SITE.x + x * COS + z * SIN, DAILY_LIFE_SITE.z - x * SIN + z * COS) - this.elevation;
	}

	private workplace(task: Task): Group {
		const group = new Group();
		const parts = new Map<MeshStandardNodeMaterial, BufferGeometry[]>();
		const add = (geometry: BufferGeometry, material: MeshStandardNodeMaterial, x: number, y: number, z: number) => {
			geometry.translate(x, y, z);
			const batch = parts.get(material) ?? [];
			batch.push(geometry);
			parts.set(material, batch);
		};
		const oval = (x: number, y: number, z: number) => new SphereGeometry(1, 14, 8).scale(x, y, z);
		if (task === 'grind') {
			add(oval(0.48, 0.16, 0.38), this.stone, 0, 0.18, 0.7);
			add(oval(0.24, 0.015, 0.23), this.grain, 0, 0.334, 0.7);
		} else if (task === 'knead') {
			add(new BoxGeometry(1.35, 0.12, 0.75), this.wood, 0, 0.72, 0.65);
			for (const x of [-0.53, 0.53])
				for (const z of [0.38, 0.92]) add(new BoxGeometry(0.07, 0.7, 0.07), this.wood, x, 0.35, z);
			add(oval(0.27, 0.055, 0.19), this.grain, 0, 0.82, 0.65);
			for (let i = 0; i < 3; i++) add(oval(0.08, 0.035, 0.11), this.grain, -0.48 + i * 0.19, 0.81, 0.92);
		}
		if (task === 'grind' || task === 'knead') {
			add(this.jar.clone(), this.clay, -0.86, 0.015, 0.5);
			add(this.jar.clone().scale(0.7, 0.75, 0.7), this.clay, -1.03, 0.015, 1.02);
		}
		for (const [material, geometries] of parts) {
			const geometry = mergeGeometries(geometries);
			for (const part of geometries) part.dispose();
			const mesh = new Mesh(geometry, material);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			group.add(mesh);
		}
		return group;
	}

	private arm(resident: Resident, left: boolean, y: number, z: number): void {
		const { mesh, rig } = resident;
		const arm = left ? rig.leftArm : rig.rightArm;
		const elbow = left ? rig.leftElbow : rig.rightElbow;
		this.target.set(arm.position.x, y, z);
		mesh.localToWorld(this.target);
		rig.spine.worldToLocal(this.target);
		this.target.sub(arm.position);
		bendLimb(arm, elbow, this.target.y, this.target.z, 0.29, 0.32, -1);
	}

	private pose(resident: Resident, time: number): void {
		const { rig, mesh, task, phase } = resident;
		const cycle = time * 2 + phase;
		const sway = Math.sin(cycle);
		rig.hips.position.y = 0.93;
		rig.spine.rotation.x = 0;
		rig.head.rotation.set(0, Math.sin(cycle * 0.31) * 0.08, 0);
		if (task === 'grind') {
			rig.hips.position.y = 0.4;
			rig.leftLeg.rotation.x = rig.rightLeg.rotation.x = -1.1;
			rig.leftKnee.rotation.x = rig.rightKnee.rotation.x = 2.2;
			rig.leftFoot.rotation.x = rig.rightFoot.rotation.x = -1.1;
			rig.spine.rotation.x = 0.28 + sway * 0.06;
			rig.head.rotation.x = 0.16;
		} else if (task === 'knead') {
			rig.spine.rotation.x = 0.16 + sway * 0.035;
			rig.head.rotation.x = 0.22;
		} else if (task === 'carry') {
			const route = time * 0.24 + phase;
			const x = resident.x + Math.sin(route) * 2.2;
			const z = resident.z + Math.cos(route) * 1.15;
			mesh.position.set(x, this.heightAt(x, z), z);
			mesh.rotation.y = Math.atan2(Math.cos(route) * 2.2, -Math.sin(route) * 1.15);
			for (const left of SIDES) {
				const step = (((time * 0.9 + phase + (left ? 0 : 0.5)) % 1) + 1) % 1;
				const swing = step > 0.62;
				const progress = swing ? (step - 0.62) / 0.38 : step / 0.62;
				const z = swing ? -0.22 + progress * 0.44 : 0.22 - progress * 0.44;
				const y = 0.07 + (swing ? Math.sin(progress * Math.PI) * 0.1 : 0);
				const leg = left ? rig.leftLeg : rig.rightLeg;
				const knee = left ? rig.leftKnee : rig.rightKnee;
				const foot = left ? rig.leftFoot : rig.rightFoot;
				bendLimb(leg, knee, y - 0.93, z, 0.43, 0.43, 1);
				foot.rotation.x = -leg.rotation.x - knee.rotation.x;
			}
		} else {
			rig.spine.rotation.y = Math.sin(cycle * 0.5) * 0.06;
			mesh.rotation.y = phase > 8 ? -1.5 : 0.7;
		}
		mesh.updateMatrixWorld(true);
		const handY = task === 'grind' ? 0.39 : task === 'knead' ? 0.87 : task === 'carry' ? 1.1 : 1.05;
		const handZ = task === 'grind' ? 0.6 + sway * 0.1 : task === 'knead' ? 0.51 + sway * 0.065 : 0.39;
		this.arm(resident, true, handY, handZ);
		this.arm(resident, false, handY + (task === 'rest' ? sway * 0.07 : 0), handZ);
	}

	update(dt: number, camera: PerspectiveCamera, presence: number, tier: Tier): void {
		const distance = camera.position.distanceTo(this.group.position);
		this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		this.frustum.setFromProjectionMatrix(this.viewProjection, camera.coordinateSystem);
		this.group.visible =
			presence > 0.6 && distance < (tier === 'low' ? 110 : 220) && this.frustum.intersectsSphere(this.bounds);
		if (!this.group.visible) return;
		const reduced = this.motionPreference.matches;
		if (!reduced) this.elapsed += dt;
		const interval = distance < 40 ? 1 / 30 : 1 / 12;
		const animate = this.sampledAt < 0 || (!reduced && this.elapsed - this.sampledAt >= interval);
		for (let i = 0; i < this.residents.length; i++) {
			const resident = this.residents[i];
			resident.mesh.visible = resident.props.visible = i < COUNTS[tier];
			if (animate && resident.mesh.visible) this.pose(resident, this.elapsed);
		}
		if (animate) this.sampledAt = this.elapsed;
	}

	dispose(): void {
		for (const { mesh, props } of this.residents) {
			mesh.skeleton.dispose();
			props.traverse((object) => {
				if (object instanceof Mesh) object.geometry.dispose();
			});
		}
		this.geometry.dispose();
		this.jar.dispose();
		this.handstone.dispose();
		for (const material of [...this.skins, this.clay, this.stone, this.wood, this.grain]) material.dispose();
		this.group.removeFromParent();
	}
}
