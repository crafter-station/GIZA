import {
	abs,
	attribute,
	cameraPosition,
	cameraViewMatrix,
	color,
	distance,
	Fn,
	float,
	floor,
	fract,
	fwidth,
	hash,
	max,
	min,
	mix,
	mx_noise_float,
	normalize,
	normalWorld,
	oneMinus,
	positionLocal,
	positionWorld,
	saturate,
	select,
	sign,
	smoothstep,
	vec3,
	vec4
} from 'three/tsl';
import { DoubleSide, MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import { STONE } from '../monuments/pyramid/generator.ts';
import { cloudShadow } from '../world/atmosphere/clouds.ts';
import { GROUND_PALETTE } from './ground.ts';
import { MASONRY_PALETTE } from './masonry-palette.ts';
import { surfaceGradientNormal } from './stone-detail.ts';

const RELIEF_DEPTH = 0.05;
const TREAD_DUST = 0.35;
const COURSE_SCALE = 0.7;
const ALIAS_PIXELS: readonly [number, number] = [1.5, 4];
const FACE_SLOPE = (52 * Math.PI) / 180;
const STEP_SHADOW_MEAN = 0.82;
const FACE_SLOPE_SIN = Math.sin(FACE_SLOPE);
const FACE_SLOPE_COS = Math.cos(FACE_SLOPE);
const RELIEF_FADE: readonly [number, number] = [40, 220];
const BASE_WEAR_HEIGHT = 7;
const PATINA_HEIGHT: readonly [number, number] = [25, 130];

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
	const pixelsPerCourse = float(COURSE_SCALE).div(fwidth(p.y).max(1e-4));
	const resolved = smoothstep(ALIAS_PIXELS[0], ALIAS_PIXELS[1], pixelsPerCourse);
	const joint = max(verticalJoint, bedJoint)
		.mul(select(stone.greaterThan(STONE.roughCore - 0.5), float(0), float(1)))
		.mul(resolved);
	const blockTone = mix(
		float(0.5),
		hash(course.mul(13.7).add(blockIndex.mul(1.37)))
			.mul(0.6)
			.add(hash(course.mul(5.11).add(0.3)).mul(0.4)),
		resolved
	);
	const grain = mx_noise_float(p.mul(0.8))
		.mul(0.5)
		.add(mx_noise_float(p.mul(3.1)).mul(0.25));
	const patina = mx_noise_float(vec3(p.x.mul(0.04), p.y.mul(0.012), p.z.mul(0.04)));
	const core = mix(
		color(MASONRY_PALETTE.coreDark),
		color(MASONRY_PALETTE.coreLight),
		saturate(blockTone.mul(0.85).add(grain.mul(0.35)).add(patina.mul(0.25)).sub(0.05))
	);
	const height = positionLocal.y;
	const baseWear = oneMinus(smoothstep(0, BASE_WEAR_HEIGHT, height)).mul(0.3);
	const heightPatina = smoothstep(PATINA_HEIGHT[0], PATINA_HEIGHT[1], height).mul(0.1);
	const dusty = mix(float(TREAD_DUST * 0.45), smoothstep(0.55, 0.9, normalWorld.y).mul(TREAD_DUST), resolved);
	const weathered = mix(core, color(MASONRY_PALETTE.patina), heightPatina);
	const coreFinal = mix(
		mix(mix(weathered, color(MASONRY_PALETTE.mortar), joint.mul(0.6)), color(GROUND_PALETTE.sandLight), dusty),
		color(GROUND_PALETTE.sandDark),
		baseWear
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

	const albedo = select(
		stone.greaterThan(STONE.pyramidion - 0.5),
		color(MASONRY_PALETTE.pyramidion).rgb,
		select(
			stone.lessThan(STONE.casing - 0.5).or(stone.greaterThan(STONE.roughCore - 0.5)),
			vec3(coreFinal),
			select(
				stone.lessThan(STONE.granite - 0.5),
				vec3(tura),
				select(stone.lessThan(STONE.recess - 0.5), vec3(granite), color(MASONRY_PALETTE.recess).rgb)
			)
		)
	);
	material.colorNode = albedo.mul(cloudShadow(p));
	material.roughnessNode = select(
		stone.greaterThan(STONE.pyramidion - 0.5),
		float(0.22),
		select(
			stone.lessThan(STONE.casing - 0.5).or(stone.greaterThan(STONE.roughCore - 0.5)),
			mix(float(0.9), float(1), dusty),
			select(stone.lessThan(STONE.granite - 0.5), float(0.7), float(0.55))
		)
	);
	const roughStone = stone.lessThan(STONE.casing - 0.5).or(stone.greaterThan(STONE.roughCore - 0.5));
	const reliefFade = oneMinus(smoothstep(RELIEF_FADE[0], RELIEF_FADE[1], distance(cameraPosition, p)));
	const pitting = mx_noise_float(p.mul(1.7))
		.mul(0.6)
		.add(mx_noise_float(p.mul(6.3)).mul(0.4));
	const relief = pitting
		.mul(select(roughStone, float(RELIEF_DEPTH), float(RELIEF_DEPTH * 0.25)))
		.mul(reliefFade)
		.sub(joint.mul(RELIEF_DEPTH * 1.5));
	const facing = select(
		abs(positionLocal.x).greaterThan(abs(positionLocal.z)),
		vec3(sign(positionLocal.x), 0, 0),
		vec3(0, 0, sign(positionLocal.z))
	);
	const faceNormal = cameraViewMatrix.mul(
		vec4(normalize(facing.mul(FACE_SLOPE_SIN).add(vec3(0, FACE_SLOPE_COS, 0))), 0)
	).xyz;
	material.normalNode = normalize(mix(faceNormal, surfaceGradientNormal(relief), resolved));
	const filterShadow = Fn(([shadow]: [Node<'float'>]) => mix(float(STEP_SHADOW_MEAN), shadow, resolved));
	material.receivedShadowNode = filterShadow as unknown as () => Node;
	material.metalnessNode = select(stone.greaterThan(STONE.pyramidion - 0.5), float(0.82), float(0));
	return material;
}
