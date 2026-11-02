import {
	exp,
	Fn,
	float,
	hash,
	If,
	mix,
	pow,
	screenCoordinate,
	screenSize,
	screenUV,
	smoothstep,
	step,
	time,
	uniform,
	vec2,
	vec3
} from 'three/tsl';
import { type Node, type PerspectiveCamera, type TextureNode, Vector2, Vector3 } from 'three/webgpu';
import type { LightingLook } from '../world/atmosphere/lighting.ts';

const CURVE_PIVOT = 0.42;
const SKY_DEPTH = 0.9999;
const OCCLUSION_RINGS: readonly [number, number][] = [
	[0, 0],
	[0.012, 0],
	[-0.012, 0],
	[0, 0.012],
	[0, -0.012],
	[0.03, 0.03],
	[-0.03, 0.03],
	[0.03, -0.03],
	[-0.03, -0.03]
];
const GHOSTS: readonly { along: number; radius: number; tint: readonly [number, number, number] }[] = [
	{ along: 0.55, radius: 0.025, tint: [1, 0.78, 0.5] },
	{ along: 1.45, radius: 0.045, tint: [0.75, 0.9, 1] },
	{ along: 1.9, radius: 0.075, tint: [1, 0.85, 0.65] }
];
const GHOST_GAIN = 0.035;
const REFERENCE_INCIDENT = 3.4;
const COMPENSATION_POWER = 0.15;
const COMPENSATION_RANGE: readonly [number, number] = [0.9, 1.2];
const ADAPTATION_SECONDS = 1.2;
const OFFSCREEN_MARGIN = 0.35;

export function createSunUniforms() {
	return {
		uv: uniform(new Vector2(0.5, 0.5)),
		visibility: uniform(0),
		strength: uniform(0),
		color: uniform(new Vector3(1, 0.9, 0.75))
	};
}

export type SunUniforms = ReturnType<typeof createSunUniforms>;

export function photographicCurve(display: Node<'vec3'>, contrast: Node<'float'>): Node<'vec3'> {
	const x = display.clamp(0, 1);
	const low = pow(x.div(CURVE_PIVOT), vec3(contrast)).mul(CURVE_PIVOT);
	const high = float(1).sub(
		pow(
			float(1)
				.sub(x)
				.div(1 - CURVE_PIVOT),
			vec3(contrast)
		).mul(1 - CURVE_PIVOT)
	);
	return mix(high, low, step(x, vec3(CURVE_PIVOT)));
}

export function filmGrain(display: Node<'vec3'>, amount: Node<'float'>): Node<'vec3'> {
	const frame = time.mul(60).floor().toUint();
	const seed = screenCoordinate.x.add(screenCoordinate.y.mul(4096)).toUint().add(frame.mul(7919));
	const luminance = display.dot(vec3(0.2126, 0.7152, 0.0722));
	const midtones = luminance.mul(float(1).sub(luminance)).mul(4);
	return display.add(hash(seed).sub(0.5).mul(amount, midtones));
}

export function sunFlareNode(sun: SunUniforms, depth: TextureNode): Node<'vec3'> {
	return Fn(() => {
		const flare = vec3(0).toVar();
		If(sun.visibility.mul(sun.strength).greaterThan(0.001), () => {
			const aspect = vec2(screenSize.x.div(screenSize.y), 1);
			let sky: Node<'float'> = float(0);
			for (const [dx, dy] of OCCLUSION_RINGS) {
				sky = sky.add(step(SKY_DEPTH, depth.sample(sun.uv.add(vec2(dx, dy))).r));
			}
			const open = sky.div(OCCLUSION_RINGS.length).mul(sun.visibility, sun.strength);
			const distance = screenUV.sub(sun.uv).mul(aspect).length();
			const aureole = exp(distance.mul(-14))
				.mul(0.35)
				.add(exp(distance.mul(-4)).mul(0.04));
			let ghosts: Node<'vec3'> = vec3(0);
			const axis = vec2(0.5, 0.5).sub(sun.uv);
			for (const ghost of GHOSTS) {
				const centre = sun.uv.add(axis.mul(ghost.along));
				const reach = screenUV.sub(centre).mul(aspect).length();
				const disc = float(1).sub(smoothstep(ghost.radius * 0.7, ghost.radius, reach));
				ghosts = ghosts.add(vec3(...ghost.tint).mul(disc));
			}
			flare.assign(sun.color.mul(aureole.add(ghosts.mul(GHOST_GAIN))).mul(open));
		});
		return flare;
	})();
}

export class SunTracker {
	private readonly point = new Vector3();
	private readonly forward = new Vector3();

	update(camera: PerspectiveCamera, sunDirection: Vector3, sun: SunUniforms, look: LightingLook): void {
		camera.getWorldDirection(this.forward);
		const facing = this.forward.dot(sunDirection);
		this.point.copy(camera.position).addScaledVector(sunDirection, 1000).project(camera);
		const u = this.point.x * 0.5 + 0.5;
		const v = 0.5 - this.point.y * 0.5;
		const onScreen = Math.min(
			smooth(-OFFSCREEN_MARGIN, 0, u) * smooth(-OFFSCREEN_MARGIN, 0, 1 - u),
			smooth(-OFFSCREEN_MARGIN, 0, v) * smooth(-OFFSCREEN_MARGIN, 0, 1 - v)
		);
		const aboveHorizon = smooth(-0.02, 0.03, sunDirection.y);
		sun.uv.value.set(u, v);
		sun.visibility.value = facing > 0 ? onScreen * aboveHorizon : 0;
		sun.strength.value = look.aureole;
	}
}

export class ExposureAdaptation {
	private value = -1;
	private last = -1;

	update(look: LightingLook, sunIntensity: number, sunHeight: number, now: number): number {
		const incident = sunIntensity * Math.max(sunHeight, 0) + look.hemisphereIntensity + look.environmentIntensity * 0.5;
		const compensation = Math.min(
			Math.max((REFERENCE_INCIDENT / Math.max(incident, 0.05)) ** COMPENSATION_POWER, COMPENSATION_RANGE[0]),
			COMPENSATION_RANGE[1]
		);
		const target = look.exposure * compensation;
		const dt = this.last < 0 ? 0 : Math.min((now - this.last) / 1000, 0.25);
		this.last = now;
		this.value = this.value < 0 ? target : target + (this.value - target) * Math.exp(-dt / ADAPTATION_SECONDS);
		return this.value;
	}

	reset(): void {
		this.value = -1;
	}
}

function smooth(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}
