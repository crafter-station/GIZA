import {
	clamp,
	color,
	cos,
	cross,
	dot,
	Fn,
	float,
	fract,
	If,
	instancedArray,
	instanceIndex,
	int,
	length,
	max,
	mix,
	normalize,
	normalLocal,
	oneMinus,
	positionLocal,
	select,
	sin,
	smoothstep,
	uniform,
	varying,
	vec3,
	vec4
} from 'three/tsl';
import {
	type ComputeNode,
	InstancedBufferGeometry,
	Mesh,
	MeshBasicNodeMaterial,
	MeshStandardNodeMaterial,
	type Node,
	type StorageBufferNode,
	Vector3,
	type WebGPURenderer
} from 'three/webgpu';
import type { BlockInfo } from '../../app/state.ts';
import { createChamferedBoxGeometry } from './geometry.ts';
import { type BlockLayout, CORE_SEED_OFFSET } from './layout.ts';

export const NO_BLOCK = 0xffffffff;

const WAVE_SECONDS = 2.2;
const JITTER_SECONDS = 0.35;
const RISE_SECONDS = 0.9;
const RADIAL_SPREAD = 1.5;
const COURSE_GAP = 0.45;
const DRIFT = 0.6;
const STIFFNESS = 22;
const SETTLE_SECONDS = WAVE_SECONDS + JITTER_SECONDS + RISE_SECONDS + 1.5;
const DAMPING = 2 * Math.sqrt(STIFFNESS);
const STONE = 0xc9a97a;
const GLOW = 0xffb46a;
export const ANTICIPATION_SECONDS = 0.6;
const FIELD_RADIUS = 14;
const FIELD_FORCE = 260;
const NO_XRAY = 1e4;
export const MAX_PHYSICS_BODIES = 3000;
const HIGHLIGHT = 0xffe2a8;

function rotateByQuaternion(vector: Node<'vec3'>, rotation: Node<'vec4'>): Node<'vec3'> {
	const twice = cross(rotation.xyz, vector).mul(2);
	return vector.add(twice.mul(rotation.w)).add(cross(rotation.xyz, twice));
}

export class BlockField {
	readonly layout: BlockLayout;
	readonly mesh: Mesh;
	readonly pickMesh: Mesh;
	readonly hovered = uniform(NO_BLOCK, 'uint');
	readonly selected = uniform(NO_BLOCK, 'uint');
	private readonly delta = uniform(0);
	private readonly elapsed = uniform(0);
	private readonly modeTime = uniform(1e4);
	private readonly deconstructing = uniform(0);
	readonly xrayCourse = uniform(NO_XRAY);
	readonly fieldOrigin = uniform(new Vector3());
	readonly fieldDirection = uniform(new Vector3(0, 0, -1));
	readonly fieldStrength = uniform(0);
	readonly anticipation = uniform(0);
	readonly inspected = uniform(NO_BLOCK, 'uint');
	readonly inspectTarget = uniform(new Vector3());
	private readonly update: ComputeNode;
	private readonly geometry: InstancedBufferGeometry;
	private readonly slots: StorageBufferNode<'int'>;
	private readonly physicsState: StorageBufferNode<'vec4'>;
	private readonly positions: StorageBufferNode<'vec4'>;
	private readonly rotations: StorageBufferNode<'vec4'>;
	private physicsIndices: Uint32Array | null = null;

	constructor(layout: BlockLayout) {
		this.layout = layout;
		const initialPositions = new Float32Array(layout.home);
		const initialRotations = new Float32Array(layout.count * 4);
		for (let i = 0; i < layout.count; i++) {
			initialPositions[i * 4 + 3] = 0;
			initialRotations[i * 4 + 3] = 1;
		}

		const homeBuffer = instancedArray(layout.home, 'vec4');
		const sizeBuffer = instancedArray(layout.size, 'vec4');
		const positionBuffer = instancedArray(initialPositions, 'vec4');
		const velocityBuffer = instancedArray(layout.count, 'vec4');
		const rotationBuffer = instancedArray(initialRotations, 'vec4');
		const courseCount = float(layout.courses);
		const slotBuffer = instancedArray(new Int32Array(layout.count).fill(-1), 'int');
		const physicsBuffer = instancedArray(new Float32Array(MAX_PHYSICS_BODIES * 8), 'vec4');
		this.slots = slotBuffer;
		this.physicsState = physicsBuffer;
		this.positions = positionBuffer;
		this.rotations = rotationBuffer;

		this.update = Fn(() => {
			const home = homeBuffer.element(instanceIndex);
			const seed = fract(sizeBuffer.element(instanceIndex).w);
			const position = positionBuffer.element(instanceIndex);
			const velocity = velocityBuffer.element(instanceIndex);
			const height = home.w.div(courseCount);
			const delay = mix(height, float(1).sub(height), this.deconstructing)
				.mul(WAVE_SECONDS)
				.add(seed.mul(JITTER_SECONDS))
				.add(this.deconstructing.mul(ANTICIPATION_SECONDS));
			const step = select(this.modeTime.greaterThan(delay), this.delta.div(RISE_SECONDS), float(0));
			const lift = clamp(position.w.add(mix(step.negate(), step, this.deconstructing)), 0, 1);
			const eased = smoothstep(0, 1, lift);
			const phase = seed.mul(6.2831).add(this.elapsed.mul(0.35));
			const drift = vec3(sin(phase), sin(phase.add(2.1)).mul(0.6), sin(phase.add(4.2))).mul(DRIFT);
			const exploded = vec3(
				home.x.mul(RADIAL_SPREAD),
				home.y.add(home.w.mul(COURSE_GAP)),
				home.z.mul(RADIAL_SPREAD)
			).add(drift);
			const inspecting = instanceIndex.equal(this.inspected);
			const target = select(inspecting, this.inspectTarget, mix(home.xyz, exploded, eased));
			const relative = position.xyz.sub(this.fieldOrigin);
			const closest = this.fieldOrigin.add(this.fieldDirection.mul(dot(relative, this.fieldDirection)));
			const away = position.xyz.sub(closest);
			const distanceToRay = length(away).max(0.001);
			const push = away
				.div(distanceToRay)
				.mul(oneMinus(smoothstep(0, FIELD_RADIUS, distanceToRay)))
				.mul(this.fieldStrength.mul(FIELD_FORCE).mul(eased));
			const acceleration = target.sub(position.xyz).mul(STIFFNESS).sub(velocity.xyz.mul(DAMPING)).add(push);
			const nextVelocity = velocity.xyz.add(acceleration.mul(this.delta)).toVar();
			const nextPosition = position.xyz.add(nextVelocity.mul(this.delta)).toVar();
			If(lift.equal(0).and(length(target.sub(nextPosition)).lessThan(0.005)), () => {
				nextPosition.assign(home.xyz);
				nextVelocity.assign(vec3(0));
			});
			const slot = slotBuffer.element(instanceIndex);
			const physical = slot.greaterThanEqual(int(0));
			const physicsIndex = select(physical, slot, int(0)).mul(2);
			const physicsPosition = physicsBuffer.element(physicsIndex);
			const physicsRotation = physicsBuffer.element(physicsIndex.add(1));
			position.assign(select(physical, vec4(physicsPosition.xyz, 1), vec4(nextPosition, lift)));
			velocity.assign(select(physical, vec4(0), vec4(nextVelocity, 0)));
			const spin = select(inspecting, this.elapsed.mul(0.6), sin(this.elapsed.mul(0.5).add(seed.mul(40))));
			const angle = eased.mul(select(inspecting, float(1), seed.mul(0.25).add(0.1))).mul(spin);
			const axis = normalize(vec3(sin(seed.mul(12.9)), cos(seed.mul(7.3)), sin(seed.mul(3.1).add(1))));
			rotationBuffer
				.element(instanceIndex)
				.assign(select(physical, physicsRotation, vec4(axis.mul(sin(angle.mul(0.5))), cos(angle.mul(0.5)))));
		})().compute(layout.count);

		const transformed = Fn(() => {
			const rotation = rotationBuffer.element(instanceIndex);
			const visible = select(homeBuffer.element(instanceIndex).w.lessThan(this.xrayCourse), float(1), float(0));
			const size = sizeBuffer.element(instanceIndex).xyz.mul(visible);
			normalLocal.assign(rotateByQuaternion(normalize(normalLocal.div(size.max(0.001))), rotation));
			return rotateByQuaternion(positionLocal.mul(size), rotation).add(positionBuffer.element(instanceIndex).xyz);
		});

		this.geometry = new InstancedBufferGeometry().copy(createChamferedBoxGeometry() as InstancedBufferGeometry);
		this.geometry.instanceCount = layout.count;

		const tag = sizeBuffer.element(instanceIndex).w;
		const tone = varying(
			fract(tag)
				.mul(0.3)
				.add(0.85)
				.mul(select(tag.greaterThan(CORE_SEED_OFFSET - 0.5), float(0.82), float(1)))
		);
		const highlight = varying(
			max(
				select(instanceIndex.equal(this.selected), float(1), float(0)),
				select(instanceIndex.equal(this.hovered), float(0.55), float(0))
			)
		);
		const material = new MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
		material.positionNode = transformed();
		material.colorNode = mix(color(STONE).mul(tone), color(HIGHLIGHT), highlight);
		material.emissiveNode = color(GLOW).mul(this.anticipation.mul(0.35));
		this.mesh = new Mesh(this.geometry, material);
		this.mesh.frustumCulled = false;

		const id = instanceIndex.add(1);
		const pickMaterial = new MeshBasicNodeMaterial();
		pickMaterial.toneMapped = false;
		pickMaterial.positionNode = transformed();
		pickMaterial.colorNode = varying(
			vec3(float(id.bitAnd(255)), float(id.shiftRight(8).bitAnd(255)), float(id.shiftRight(16).bitAnd(255))).div(255)
		);
		this.pickMesh = new Mesh(this.geometry, pickMaterial);
		this.pickMesh.frustumCulled = false;
	}

	get physicsActive(): boolean {
		return this.physicsIndices !== null;
	}

	async readTransforms(renderer: WebGPURenderer): Promise<{ positions: Float32Array; rotations: Float32Array }> {
		const [positions, rotations] = await Promise.all([
			renderer.getArrayBufferAsync(this.positions.value as never),
			renderer.getArrayBufferAsync(this.rotations.value as never)
		]);
		return {
			positions: new Float32Array(positions as ArrayBuffer),
			rotations: new Float32Array(rotations as ArrayBuffer)
		};
	}

	startPhysics(indices: Uint32Array): void {
		const slots = this.slots.value.array as Int32Array;
		slots.fill(-1);
		indices.forEach((block, slot) => {
			slots[block] = slot;
		});
		this.slots.value.needsUpdate = true;
		this.physicsIndices = indices;
	}

	applyPhysics(state: Float32Array): void {
		if (!this.physicsIndices) return;
		(this.physicsState.value.array as Float32Array).set(state.subarray(0, MAX_PHYSICS_BODIES * 8));
		this.physicsState.value.needsUpdate = true;
	}

	stopPhysics(): void {
		if (!this.physicsIndices) return;
		(this.slots.value.array as Int32Array).fill(-1);
		this.slots.value.needsUpdate = true;
		this.physicsIndices = null;
	}

	get xrayActive(): boolean {
		return this.xrayCourse.value < NO_XRAY;
	}

	setXray(course: number | null): void {
		this.xrayCourse.value = course === null ? NO_XRAY : course;
	}

	get deconstructed(): boolean {
		return this.deconstructing.value === 1;
	}

	get settled(): boolean {
		return !this.deconstructed && this.modeTime.value > SETTLE_SECONDS;
	}

	placeAt(x: number, y: number, z: number): void {
		this.mesh.position.set(x, y, z);
		this.pickMesh.position.set(x, y, z);
	}

	setDeconstructed(value: boolean): void {
		if (this.deconstructed === value) return;
		this.deconstructing.value = value ? 1 : 0;
		this.modeTime.value = 0;
	}

	step(renderer: WebGPURenderer, dt: number): void {
		this.delta.value = dt;
		this.elapsed.value += dt;
		this.modeTime.value += dt;
		renderer.compute(this.update);
	}

	info(index: number): BlockInfo {
		const { home, size } = this.layout;
		const core = size[index * 4 + 3] >= CORE_SEED_OFFSET;
		return {
			index,
			course: home[index * 4 + 3] + 1,
			size: [size[index * 4], size[index * 4 + 1], size[index * 4 + 2]],
			kind: core ? 'core' : 'block',
			represents: core ? this.layout.blocksPerCoreCell : 1
		};
	}

	dispose(): void {
		this.geometry.dispose();
		(this.mesh.material as MeshStandardNodeMaterial).dispose();
		(this.pickMesh.material as MeshBasicNodeMaterial).dispose();
	}
}
