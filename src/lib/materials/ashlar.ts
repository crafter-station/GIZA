import {
	abs,
	cameraPosition,
	color,
	distance,
	float,
	floor,
	fract,
	hash,
	max,
	min,
	mix,
	mx_noise_float,
	normalWorld,
	oneMinus,
	positionWorld,
	saturate,
	select,
	smoothstep,
	vec3
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { cloudShadow } from '../world/atmosphere/clouds.ts';
import { GROUND_PALETTE } from './ground.ts';
import { MASONRY_PALETTE } from './masonry-palette.ts';
import { surfaceGradientNormal } from './stone-detail.ts';

export interface AshlarStyle {
	courseHeight: number;
	blockLength: readonly [number, number];
	joint: number;
	light: number;
	dark: number;
	mortar: number;
	roughness: number;
	relief: number;
	dust: number;
}

export const ASHLAR_STYLES = {
	limestone: {
		courseHeight: 0.85,
		blockLength: [1.1, 2.2],
		joint: 0.035,
		light: MASONRY_PALETTE.coreLight,
		dark: MASONRY_PALETTE.coreDark,
		mortar: MASONRY_PALETTE.mortar,
		roughness: 0.9,
		relief: 0.04,
		dust: 0.45
	},
	granite: {
		courseHeight: 1.6,
		blockLength: [2.2, 4.2],
		joint: 0.02,
		light: MASONRY_PALETTE.granite,
		dark: MASONRY_PALETTE.graniteDark,
		mortar: MASONRY_PALETTE.graniteWeathered,
		roughness: 0.6,
		relief: 0.015,
		dust: 0.3
	},
	mudbrick: {
		courseHeight: 0.12,
		blockLength: [0.32, 0.36],
		joint: 0.012,
		light: 0xa8865c,
		dark: 0x7c5f40,
		mortar: 0xb59d7c,
		roughness: 0.97,
		relief: 0.008,
		dust: 0.55
	}
} as const satisfies Record<string, AshlarStyle>;

const RELIEF_FADE: readonly [number, number] = [30, 160];

export function createAshlarMaterial(style: AshlarStyle): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: style.roughness, metalness: 0 });
	const p = positionWorld;
	const n = normalWorld;
	const sideways = abs(n.x).greaterThan(abs(n.z));
	const along = select(sideways, p.z, p.x);
	const level = p.y.div(style.courseHeight);
	const course = floor(level);
	const rise = fract(level).mul(style.courseHeight);
	const length = mix(float(style.blockLength[0]), float(style.blockLength[1]), hash(course.mul(3.17).add(0.5)));
	const shifted = along.add(hash(course.mul(7.31).add(1)).mul(length)).div(length);
	const block = floor(shifted);
	const offset = min(fract(shifted), oneMinus(fract(shifted))).mul(length);
	const upward = smoothstep(0.6, 0.85, n.y);
	const verticalJoint = oneMinus(smoothstep(style.joint * 0.5, style.joint, offset));
	const bedJoint = oneMinus(smoothstep(style.joint * 0.5, style.joint, min(rise, float(style.courseHeight).sub(rise))));
	const joint = max(verticalJoint, bedJoint).mul(oneMinus(upward));
	const tone = hash(course.mul(13.7).add(block.mul(1.37)));
	const grain = mx_noise_float(p.mul(1.6)).mul(0.6);
	const stone = mix(color(style.dark), color(style.light), saturate(tone.mul(0.6).add(grain.mul(0.4)).add(0.2)));
	const weathered = mix(stone, color(style.mortar), joint.mul(0.65));
	const dusty = mix(weathered, color(GROUND_PALETTE.sandLight), upward.mul(style.dust));
	material.colorNode = vec3(dusty).mul(cloudShadow(p));
	const fade = oneMinus(smoothstep(RELIEF_FADE[0], RELIEF_FADE[1], distance(cameraPosition, p)));
	const height = grain
		.mul(style.relief)
		.sub(joint.mul(style.relief * 2.5))
		.mul(fade);
	material.normalNode = surfaceGradientNormal(height);
	material.roughnessNode = mix(float(style.roughness), float(1), upward.mul(style.dust));
	return material;
}
