import { dot, float, max, mx_noise_float, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import { type Node, Vector2, Vector3 } from 'three/webgpu';
import { WIND_DIRECTION_XZ } from './wind.ts';

const CLOUD_HEIGHT = 6000;
const ALONG_SCALE = 5200;
const ACROSS_SCALE = 1300;
const DRIFT_SPEED = 9;
const SHADOW_STRENGTH = 0.32;
const MIN_SUN_HEIGHT = 0.06;
const [WX, WZ] = WIND_DIRECTION_XZ;

export const cloudState = {
	coverage: uniform(0),
	offset: uniform(new Vector2()),
	sunDirection: uniform(new Vector3(0, 1, 0)),
	daylight: uniform(1)
};

export function cloudDensity(plane: Node<'vec2'>): Node<'float'> {
	const p = plane.add(cloudState.offset);
	const along = dot(p, vec2(WX, WZ)).div(ALONG_SCALE);
	const across = dot(p, vec2(-WZ, WX)).div(ACROSS_SCALE);
	const base = mx_noise_float(vec3(along, across, 0.7))
		.mul(0.65)
		.add(mx_noise_float(vec3(along.mul(3.1), across.mul(2.7), 4.2)).mul(0.35))
		.mul(0.5)
		.add(0.5);
	const threshold = float(1).sub(cloudState.coverage);
	return smoothstep(threshold.sub(0.12), threshold.add(0.22), base).mul(cloudState.coverage.greaterThan(0.001));
}

export function cloudShadow(position: Node<'vec3'>): Node<'float'> {
	const sun = cloudState.sunDirection;
	const reach = float(CLOUD_HEIGHT).sub(position.y).div(max(sun.y, MIN_SUN_HEIGHT));
	const plane = vec2(position.x.add(sun.x.mul(reach)), position.z.add(sun.z.mul(reach)));
	return float(1).sub(cloudDensity(plane).mul(SHADOW_STRENGTH, cloudState.daylight));
}

export function cloudPlane(origin: Node<'vec3'>, direction: Node<'vec3'>): Node<'vec2'> {
	const reach = float(CLOUD_HEIGHT).sub(origin.y).div(max(direction.y, 0.02));
	return vec2(origin.x.add(direction.x.mul(reach)), origin.z.add(direction.z.mul(reach)));
}

export function advanceClouds(dt: number): void {
	cloudState.offset.value.x -= WX * DRIFT_SPEED * dt;
	cloudState.offset.value.y -= WZ * DRIFT_SPEED * dt;
}
