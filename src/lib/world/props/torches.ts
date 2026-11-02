import { color, float, hash, instancedArray, instanceIndex, sin, smoothstep, time, uniform, uv, vec2 } from 'three/tsl';
import {
	AdditiveBlending,
	CylinderGeometry,
	InstancedMesh,
	Matrix4,
	MeshStandardNodeMaterial,
	PointLight,
	Sprite,
	SpriteNodeMaterial,
	type Vector3
} from 'three/webgpu';

export interface TorchPathPoint {
	x: number;
	z: number;
}

export interface TorchPath {
	points: readonly TorchPathPoint[];
	width: number;
}

const POLE_HEIGHT = 2.2;
const FLAME_SIZE = 0.9;
const FLAME = 0xffa04a;
const LIGHT_RANGE = 45;

export function torchPositions(paths: readonly TorchPath[], spacing: number): [number, number][] {
	const positions: [number, number][] = [];
	for (const path of paths) {
		let carried = 0;
		for (let i = 1; i < path.points.length; i++) {
			const a = path.points[i - 1];
			const b = path.points[i];
			const length = Math.hypot(b.x - a.x, b.z - a.z);
			if (length === 0) continue;
			const nx = -(b.z - a.z) / length;
			const nz = (b.x - a.x) / length;
			const side = path.width / 2 + 1.5;
			for (let along = carried; along <= length; along += spacing) {
				const t = along / length;
				const x = a.x + (b.x - a.x) * t;
				const z = a.z + (b.z - a.z) * t;
				positions.push([x + nx * side, z + nz * side], [x - nx * side, z - nz * side]);
			}
			carried = (spacing - ((length - carried) % spacing)) % spacing;
		}
	}
	return positions;
}

export class Torches {
	readonly group: InstancedMesh;
	readonly flames: Sprite;
	readonly lights: PointLight[];
	private readonly tops: Float32Array;
	private readonly glow = uniform(0);

	constructor(positions: readonly [number, number][], groundAt: (x: number, z: number) => number, lightCount: number) {
		const count = positions.length;
		this.tops = new Float32Array(count * 4);
		const poleMaterial = new MeshStandardNodeMaterial({ color: 0x3a2a1c, roughness: 0.9 });
		this.group = new InstancedMesh(new CylinderGeometry(0.07, 0.09, POLE_HEIGHT, 6), poleMaterial, count);
		this.group.name = 'torch-poles';
		const matrix = new Matrix4();
		positions.forEach(([x, z], i) => {
			const ground = groundAt(x, z);
			matrix.makeTranslation(x, ground + POLE_HEIGHT / 2, z);
			this.group.setMatrixAt(i, matrix);
			this.tops.set([x, ground + POLE_HEIGHT + FLAME_SIZE * 0.35, z, 0], i * 4);
		});
		const top = instancedArray(this.tops, 'vec4').element(instanceIndex);
		const seed = hash(instanceIndex);
		const flicker = sin(time.mul(11).add(seed.mul(40)))
			.mul(0.12)
			.add(sin(time.mul(23).add(seed.mul(17))).mul(0.08))
			.add(0.9);
		const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
		material.fog = false;
		material.positionNode = top.xyz;
		material.scaleNode = float(FLAME_SIZE).mul(flicker);
		const centre = uv().sub(vec2(0.5, 0.4)).mul(vec2(1.6, 1));
		const shape = smoothstep(0, 0.5, float(0.5).sub(centre.length()));
		material.colorNode = color(FLAME).mul(flicker).mul(9);
		material.opacityNode = shape.mul(this.glow);
		this.flames = new Sprite(material);
		this.flames.count = count;
		this.flames.name = 'torch-flames';
		this.flames.frustumCulled = false;
		this.lights = Array.from({ length: lightCount }, () => new PointLight(FLAME, 0, LIGHT_RANGE, 2));
		this.setVisible(false);
	}

	private setVisible(visible: boolean): void {
		this.group.visible = visible;
		this.flames.visible = visible;
	}

	update(camera: Vector3, night: number): void {
		this.glow.value = night;
		this.setVisible(night > 0.02);
		if (night <= 0.02) {
			for (const light of this.lights) light.intensity = 0;
			return;
		}
		const count = this.tops.length / 4;
		const nearest = Array.from({ length: count }, (_, i) => i)
			.sort(
				(a, b) =>
					Math.hypot(this.tops[a * 4] - camera.x, this.tops[a * 4 + 2] - camera.z) -
					Math.hypot(this.tops[b * 4] - camera.x, this.tops[b * 4 + 2] - camera.z)
			)
			.slice(0, this.lights.length);
		this.lights.forEach((light, slot) => {
			const index = nearest[slot];
			light.intensity = index === undefined ? 0 : night * 60 * (0.9 + Math.random() * 0.1);
			if (index !== undefined)
				light.position.set(this.tops[index * 4], this.tops[index * 4 + 1], this.tops[index * 4 + 2]);
		});
	}

	dispose(): void {
		this.group.geometry.dispose();
		(this.group.material as MeshStandardNodeMaterial).dispose();
		this.flames.geometry.dispose();
		(this.flames.material as SpriteNodeMaterial).dispose();
		for (const light of this.lights) light.dispose();
	}
}
