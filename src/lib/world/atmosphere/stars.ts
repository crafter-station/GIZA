import {
	float,
	instancedArray,
	instanceIndex,
	modelWorldMatrix,
	smoothstep,
	uniform,
	uv,
	varying,
	vec4
} from 'three/tsl';
import { Matrix4, PointsNodeMaterial, Sprite, type Vector3 } from 'three/webgpu';
import { localSiderealAngle, unitVector } from '../../data/sky.ts';
import { ANCIENT_STARS, STAR_STRIDE } from '../../data/stars-ancient.ts';

const SKY_RADIUS = 7000;
const BRIGHTEST_SIZE = 5.5;
const FAINTEST_SIZE = 1.4;
const DEG = Math.PI / 180;
const STAR_GAIN = 2.2;

function colorOf(colorIndex: number): [number, number, number] {
	const t = Math.min(Math.max((colorIndex + 0.3) / 2.2, 0), 1);
	return [0.72 + 0.28 * t, 0.82 + 0.08 * (1 - Math.abs(t - 0.4)), 1 - 0.55 * t];
}

export class StarField {
	readonly mesh: Sprite;
	private readonly visibility = uniform(0);
	private readonly rotation = new Matrix4();
	private readonly placement = new Matrix4();

	constructor(private readonly latitude: number) {
		const count = ANCIENT_STARS.length / STAR_STRIDE;
		const directions = new Float32Array(count * 4);
		const looks = new Float32Array(count * 4);
		for (let i = 0; i < count; i++) {
			const o = i * STAR_STRIDE;
			const magnitude = ANCIENT_STARS[o + 2];
			const [r, g, b] = colorOf(ANCIENT_STARS[o + 3]);
			const flux = STAR_GAIN * Math.min(10 ** (-0.2 * (magnitude - 1)), 2.5);
			directions.set([...unitVector(ANCIENT_STARS[o], ANCIENT_STARS[o + 1]), 0], i * 4);
			const size = FAINTEST_SIZE + (BRIGHTEST_SIZE - FAINTEST_SIZE) * Math.min(Math.max((5.2 - magnitude) / 6, 0), 1);
			looks.set([r * flux, g * flux, b * flux, size], i * 4);
		}
		const direction = instancedArray(directions, 'vec4').element(instanceIndex);
		const look = instancedArray(looks, 'vec4').element(instanceIndex);
		const material = new PointsNodeMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false });
		material.fog = false;
		material.positionNode = direction.xyz;
		material.sizeNode = look.w;
		const altitude = varying(modelWorldMatrix.mul(vec4(direction.xyz, 0)).xyz.normalize().y);
		const disc = smoothstep(0, 0.5, float(0.5).sub(uv().sub(0.5).length()));
		const horizon = smoothstep(0.01, 0.08, altitude);
		material.colorNode = vec4(varying(look.xyz), 1);
		material.opacityNode = disc.mul(horizon, this.visibility);
		this.mesh = new Sprite(material);
		this.mesh.count = count;
		this.mesh.name = 'ancient-stars';
		this.mesh.frustumCulled = false;
		this.mesh.matrixAutoUpdate = false;
		this.mesh.renderOrder = -1;
		this.mesh.visible = false;
	}

	update(camera: Vector3, date: Date, longitude: number, night: number): void {
		this.visibility.value = night;
		this.mesh.visible = night > 0.01;
		if (!this.mesh.visible) return;
		const sidereal = localSiderealAngle(date, longitude);
		const phi = this.latitude * DEG;
		const c = Math.cos(sidereal);
		const s = Math.sin(sidereal);
		this.rotation.set(
			-s,
			c,
			0,
			0,
			Math.cos(phi) * c,
			Math.cos(phi) * s,
			Math.sin(phi),
			0,
			Math.sin(phi) * c,
			Math.sin(phi) * s,
			-Math.cos(phi),
			0,
			0,
			0,
			0,
			1
		);
		this.placement.makeScale(SKY_RADIUS, SKY_RADIUS, SKY_RADIUS).premultiply(this.rotation).setPosition(camera);
		this.mesh.matrix.copy(this.placement);
		this.mesh.matrixWorldNeedsUpdate = true;
	}

	dispose(): void {
		this.mesh.geometry.dispose();
		(this.mesh.material as PointsNodeMaterial).dispose();
	}
}
