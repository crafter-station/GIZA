import {
	color,
	cos,
	float,
	hash,
	instanceIndex,
	select,
	sin,
	smoothstep,
	time,
	uniform,
	uv,
	vec3,
	vec4
} from 'three/tsl';
import { Sprite, SpriteNodeMaterial, type Vector3, Vector4 } from 'three/webgpu';
import { WIND_DIRECTION_XZ } from '../atmosphere/wind.ts';

const PARTICLES_PER_DEVIL = 260;
const COLUMN_HEIGHT = 65;
const RISE_SPEED = 0.07;
const LIFETIME_SECONDS = 32;
const COOLDOWN_SECONDS: readonly [number, number] = [18, 55];
const SPAWN_DISTANCE: readonly [number, number] = [400, 1200];
const DRIFT_SPEED = 4;
const MIN_DAYLIGHT = 0.3;
const OPACITY = 0.16;
const DUST = 0xd9b98c;

const createDevilUniform = () => uniform(new Vector4(0, 0, 0, -1));

interface Devil {
	uniform: ReturnType<typeof createDevilUniform>;
	life: number;
	cooldown: number;
}

export class DustDevils {
	readonly mesh: Sprite;
	private readonly devils: Devil[];
	private readonly light = uniform(1);

	constructor(
		private readonly groundAt: (x: number, z: number) => number,
		private readonly isSand: (x: number, z: number) => boolean
	) {
		this.devils = [0, 1].map((i) => ({
			uniform: createDevilUniform(),
			life: -1,
			cooldown: 6 + i * 20
		}));
		const [first, second] = this.devils;
		const devil = vec4(select(instanceIndex.lessThan(PARTICLES_PER_DEVIL), first.uniform, second.uniform));
		const seed = hash(instanceIndex);
		const climb = seed.mul(7.31).add(time.mul(RISE_SPEED)).fract();
		const height = climb.mul(COLUMN_HEIGHT);
		const spin = seed
			.mul(Math.PI * 2)
			.add(time.mul(seed.mul(0.8).add(1.4)))
			.add(height.mul(0.05));
		const radius = float(1.2).add(height.mul(0.13)).add(seed.mul(1.6));
		const lean = sin(time.mul(0.6).add(height.mul(0.05))).mul(height.mul(0.08));
		const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false });
		material.positionNode = vec3(
			devil.x.add(cos(spin).mul(radius)).add(lean),
			devil.z.add(height),
			devil.y.add(sin(spin).mul(radius))
		);
		material.scaleNode = float(2.2).add(height.mul(0.06));
		const envelope = sin(devil.w.clamp(0, 1).mul(Math.PI)).mul(select(devil.w.greaterThanEqual(0), float(1), float(0)));
		const fade = float(1)
			.sub(climb)
			.pow(0.7)
			.mul(smoothstep(0, 0.06, climb));
		const disc = smoothstep(0, 0.5, float(0.5).sub(uv().sub(0.5).length()));
		material.colorNode = vec4(color(DUST).mul(this.light), 1);
		material.opacityNode = disc.mul(envelope, fade, OPACITY);
		this.mesh = new Sprite(material);
		this.mesh.count = PARTICLES_PER_DEVIL * this.devils.length;
		this.mesh.name = 'dust-devils';
		this.mesh.frustumCulled = false;
	}

	update(dt: number, camera: Vector3, daylight: number): void {
		this.light.value = 0.35 + daylight * 0.65;
		let visible = false;
		for (const devil of this.devils) {
			const value = devil.uniform.value;
			if (devil.life >= 0) {
				devil.life += dt / LIFETIME_SECONDS;
				value.x += WIND_DIRECTION_XZ[0] * DRIFT_SPEED * dt;
				value.y += WIND_DIRECTION_XZ[1] * DRIFT_SPEED * dt;
				value.z = this.groundAt(value.x, value.y);
				if (devil.life >= 1) {
					devil.life = -1;
					devil.cooldown = COOLDOWN_SECONDS[0] + Math.random() * (COOLDOWN_SECONDS[1] - COOLDOWN_SECONDS[0]);
				}
			} else {
				devil.cooldown -= dt;
				if (devil.cooldown <= 0 && daylight > MIN_DAYLIGHT) this.spawn(devil, camera);
			}
			value.w = devil.life;
			visible ||= devil.life >= 0;
		}
		this.mesh.visible = visible;
	}

	private spawn(devil: Devil, camera: Vector3): void {
		for (let attempt = 0; attempt < 8; attempt++) {
			const angle = Math.random() * Math.PI * 2;
			const distance = SPAWN_DISTANCE[0] + Math.random() * (SPAWN_DISTANCE[1] - SPAWN_DISTANCE[0]);
			const x = camera.x + Math.cos(angle) * distance;
			const z = camera.z + Math.sin(angle) * distance;
			if (!this.isSand(x, z)) continue;
			devil.uniform.value.set(x, z, this.groundAt(x, z), 0);
			devil.life = 0;
			return;
		}
		devil.cooldown = COOLDOWN_SECONDS[0];
	}

	dispose(): void {
		this.mesh.geometry.dispose();
		(this.mesh.material as SpriteNodeMaterial).dispose();
	}
}
