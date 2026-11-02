import {
	cameraPosition,
	color,
	dot,
	Fn,
	float,
	hash,
	If,
	instancedArray,
	instanceIndex,
	mod,
	normalize,
	positionWorld,
	sin,
	smoothstep,
	time,
	uniform,
	uv,
	vec3,
	vec4
} from 'three/tsl';
import {
	AdditiveBlending,
	type ComputeNode,
	Sprite,
	SpriteNodeMaterial,
	Vector3,
	type WebGPURenderer
} from 'three/webgpu';
import { WIND_DIRECTION_XZ } from './wind.ts';

const MOTE_BOX = 70;
const MOTE_SIZE = 0.09;
const MOTE_WIND = 1.6;
const BURST_SECONDS = 3.2;
const BURST_SIZE = 4.2;
const DUST = 0xe6cfa4;

function softDisc() {
	return smoothstep(0, 0.5, float(0.5).sub(uv().sub(0.5).length()));
}

export class DustMotes {
	readonly mesh: Sprite;
	private readonly update: ComputeNode;
	private readonly origin = uniform(new Vector3());
	private readonly delta = uniform(0);
	private readonly sunDirection = uniform(new Vector3(0, 1, 0));
	private readonly light = uniform(0);

	constructor(count: number) {
		const seeds = new Float32Array(count * 4);
		for (let i = 0; i < count; i++)
			seeds.set([Math.random() * MOTE_BOX, Math.random() * MOTE_BOX, Math.random() * MOTE_BOX, Math.random()], i * 4);
		const local = instancedArray(seeds, 'vec4');
		const wind = vec3(WIND_DIRECTION_XZ[0], 0, WIND_DIRECTION_XZ[1]).mul(MOTE_WIND);
		this.update = Fn(() => {
			const p = local.element(instanceIndex);
			const phase = p.w.mul(40);
			const swirl = vec3(
				sin(time.mul(0.7).add(phase)),
				sin(time.mul(0.45).add(phase.mul(1.7))).mul(0.5),
				sin(time.mul(0.6).add(phase.mul(2.3)))
			);
			p.xyz.assign(mod(p.xyz.add(wind.add(swirl.mul(0.35)).mul(this.delta)), MOTE_BOX));
		})().compute(count);

		const p = local.element(instanceIndex);
		const world = mod(p.xyz.sub(this.origin), MOTE_BOX)
			.add(this.origin)
			.sub(MOTE_BOX / 2);
		const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
		material.positionNode = world;
		material.scaleNode = float(MOTE_SIZE).mul(p.w.mul(1.5).add(0.5));
		const view = normalize(positionWorld.sub(cameraPosition));
		const forward = dot(view, this.sunDirection).max(0);
		const scattering = forward.pow(6).mul(1.4).add(0.05);
		const nearFade = smoothstep(1.5, 6, positionWorld.sub(cameraPosition).length());
		const farFade = float(1).sub(
			smoothstep(MOTE_BOX * 0.3, MOTE_BOX * 0.5, positionWorld.sub(cameraPosition).length())
		);
		material.colorNode = vec4(color(DUST).mul(this.light).mul(scattering), 1);
		material.opacityNode = softDisc().mul(nearFade, farFade, 0.55);
		this.mesh = new Sprite(material);
		this.mesh.count = count;
		this.mesh.name = 'dust-motes';
		this.mesh.frustumCulled = false;
	}

	step(renderer: WebGPURenderer, dt: number, camera: Vector3, sunDirection: Vector3, light: number): void {
		this.delta.value = dt;
		this.origin.value.copy(camera);
		this.sunDirection.value.copy(sunDirection);
		this.light.value = light;
		this.mesh.visible = light > 0.01;
		if (this.mesh.visible) renderer.compute(this.update);
	}

	dispose(): void {
		this.update.dispose();
		this.mesh.geometry.dispose();
		(this.mesh.material as SpriteNodeMaterial).dispose();
	}
}

export interface BurstShape {
	baseSide: number;
	height: number;
}

export class JointDust {
	readonly mesh: Sprite;
	private readonly reset: ComputeNode;
	private readonly update: ComputeNode;
	private readonly age = uniform(BURST_SECONDS);
	private readonly delta = uniform(0);
	private readonly light = uniform(1);

	constructor(count: number, shape: BurstShape) {
		const positions = instancedArray(count, 'vec4');
		const velocities = instancedArray(count, 'vec4');
		const half = shape.baseSide / 2;
		this.reset = Fn(() => {
			const r1 = hash(instanceIndex);
			const r2 = hash(instanceIndex.add(7919));
			const r3 = hash(instanceIndex.add(15013));
			const r4 = hash(instanceIndex.add(27449));
			const y = r1
				.sqrt()
				.oneMinus()
				.mul(shape.height * 0.92);
			const reach = float(half).mul(y.div(shape.height).oneMinus());
			const along = r2.mul(2).sub(1).mul(reach);
			const face = r3.mul(4).floor();
			const normal = vec3(0, 0, 1).toVar();
			const point = vec3(along, y, reach).toVar();
			If(face.equal(1), () => {
				normal.assign(vec3(1, 0, 0));
				point.assign(vec3(reach, y, along));
			});
			If(face.equal(2), () => {
				normal.assign(vec3(0, 0, -1));
				point.assign(vec3(along, y, reach.negate()));
			});
			If(face.equal(3), () => {
				normal.assign(vec3(-1, 0, 0));
				point.assign(vec3(reach.negate(), y, along));
			});
			positions.element(instanceIndex).assign(vec4(point, r4));
			velocities.element(instanceIndex).assign(vec4(normal.mul(r4.mul(2.5).add(0.6)).add(vec3(0, r2.mul(1.2), 0)), 0));
		})().compute(count);
		const wind = vec3(WIND_DIRECTION_XZ[0], 0, WIND_DIRECTION_XZ[1]);
		this.update = Fn(() => {
			const p = positions.element(instanceIndex);
			const v = velocities.element(instanceIndex);
			v.xyz.assign(v.xyz.mul(float(1).sub(this.delta.mul(0.6))).add(wind.mul(this.delta.mul(0.8))));
			p.xyz.addAssign(v.xyz.mul(this.delta));
		})().compute(count);

		const p = positions.element(instanceIndex);
		const life = this.age.div(BURST_SECONDS).clamp(0, 1);
		const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false });
		material.positionNode = p.xyz;
		material.scaleNode = float(BURST_SIZE).mul(life.mul(1.8).add(0.4), p.w.add(0.5));
		material.colorNode = vec4(color(DUST).mul(this.light), 1);
		material.opacityNode = softDisc().mul(smoothstep(0, 0.08, life), float(1).sub(smoothstep(0.35, 1, life)), 0.2);
		this.mesh = new Sprite(material);
		this.mesh.count = count;
		this.mesh.name = 'joint-dust';
		this.mesh.frustumCulled = false;
		this.mesh.visible = false;
	}

	trigger(renderer: WebGPURenderer): void {
		this.age.value = 0;
		renderer.compute(this.reset);
		this.mesh.visible = true;
	}

	step(renderer: WebGPURenderer, dt: number, light: number): void {
		if (!this.mesh.visible) return;
		this.age.value += dt;
		this.delta.value = dt;
		this.light.value = light;
		if (this.age.value >= BURST_SECONDS) {
			this.mesh.visible = false;
			return;
		}
		renderer.compute(this.update);
	}

	dispose(): void {
		this.reset.dispose();
		this.update.dispose();
		this.mesh.geometry.dispose();
		(this.mesh.material as SpriteNodeMaterial).dispose();
	}
}
