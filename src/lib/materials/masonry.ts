import {
	abs,
	attribute,
	color,
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
import { DoubleSide, MeshStandardNodeMaterial } from 'three/webgpu';
import { STONE } from '../monuments/pyramid/generator.ts';
import { GROUND_PALETTE } from './ground.ts';

export const MASONRY_PALETTE = {
	coreLight: 0xd6bf94,
	coreDark: 0xae9168,
	tura: 0xe9dfc8,
	turaStain: 0xc8b48f,
	granite: 0xb07563,
	graniteDark: 0x3d322d,
	graniteLight: 0xe2d0c4,
	graniteWeathered: 0x9d9087,
	mortar: 0xc9b9a0,
	recess: 0x2e2722
} as const;

export function createMasonryMaterial(): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: DoubleSide });
	const stone = attribute('stone', 'float');
	const along = attribute('along', 'float');
	const courseV = attribute('courseV', 'float');
	const course = attribute('course', 'float');
	const p = positionWorld;

	const blockLength = hash(course.mul(3.17)).mul(0.9).add(1.4);
	const offset = hash(course.mul(7.31).add(1)).mul(blockLength);
	const local = along.add(offset).div(blockLength);
	const blockIndex = floor(local);
	const edge = min(fract(local), oneMinus(fract(local)));
	const riser = oneMinus(smoothstep(0.35, 0.75, abs(normalWorld.y)));
	const verticalJoint = oneMinus(smoothstep(0.02, 0.06, edge)).mul(riser);
	const bedJoint = oneMinus(smoothstep(0.03, 0.09, courseV)).mul(riser);
	const joint = max(verticalJoint, bedJoint).mul(select(stone.greaterThan(STONE.roughCore - 0.5), float(0), float(1)));
	const blockTone = hash(course.mul(13.7).add(blockIndex.mul(1.37)));
	const grain = mx_noise_float(p.mul(0.8))
		.mul(0.5)
		.add(mx_noise_float(p.mul(3.1)).mul(0.25));
	const patina = mx_noise_float(vec3(p.x.mul(0.04), p.y.mul(0.012), p.z.mul(0.04)));
	const core = mix(
		color(MASONRY_PALETTE.coreDark),
		color(MASONRY_PALETTE.coreLight),
		saturate(blockTone.mul(0.55).add(grain.mul(0.35)).add(patina.mul(0.2)).add(0.25))
	);
	const dusty = smoothstep(0.55, 0.9, normalWorld.y).mul(0.55);
	const coreFinal = mix(
		mix(core, color(MASONRY_PALETTE.mortar), joint.mul(0.6)),
		color(GROUND_PALETTE.sandLight),
		dusty
	);

	const streak = mx_noise_float(vec3(p.x.mul(0.35), p.y.mul(0.03), p.z.mul(0.35)));
	const turaCourse = oneMinus(smoothstep(0.0, 0.03, fract(p.y.div(1.1)))).mul(0.25);
	const tura = mix(color(MASONRY_PALETTE.tura), color(MASONRY_PALETTE.turaStain), saturate(streak.mul(0.6).add(0.2)))
		.mul(oneMinus(turaCourse))
		.toVar();

	const speckle = mx_noise_float(p.mul(9));
	const weathering = saturate(mx_noise_float(p.mul(0.35)).mul(0.5).add(0.35));
	const granite = mix(
		mix(
			mix(color(MASONRY_PALETTE.granite), color(MASONRY_PALETTE.graniteWeathered), weathering),
			color(MASONRY_PALETTE.graniteDark),
			smoothstep(0.35, 0.6, speckle)
		),
		color(MASONRY_PALETTE.graniteLight),
		oneMinus(smoothstep(-0.7, -0.45, speckle)).mul(0.6)
	);

	material.colorNode = select(
		stone.lessThan(STONE.casing - 0.5).or(stone.greaterThan(STONE.roughCore - 0.5)),
		vec3(coreFinal),
		select(
			stone.lessThan(STONE.granite - 0.5),
			vec3(tura),
			select(stone.lessThan(STONE.recess - 0.5), vec3(granite), color(MASONRY_PALETTE.recess).rgb)
		)
	);
	material.roughnessNode = select(
		stone.lessThan(STONE.casing - 0.5).or(stone.greaterThan(STONE.roughCore - 0.5)),
		float(0.93),
		select(stone.lessThan(STONE.granite - 0.5), float(0.7), float(0.55))
	);
	return material;
}
