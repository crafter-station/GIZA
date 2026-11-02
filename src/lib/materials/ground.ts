import {
	abs,
	attribute,
	cameraPosition,
	cameraViewMatrix,
	color,
	distance,
	dot,
	Fn,
	float,
	max,
	mix,
	modelWorldMatrix,
	mx_noise_float,
	normalize,
	oneMinus,
	positionLocal,
	positionWorld,
	saturate,
	sin,
	smoothstep,
	texture,
	time,
	uniform,
	vec2,
	vec3,
	vec4
} from 'three/tsl';
import {
	ClampToEdgeWrapping,
	DataTexture,
	DataUtils,
	HalfFloatType,
	LinearFilter,
	MeshStandardNodeMaterial,
	type Node,
	RGFormat,
	Vector4
} from 'three/webgpu';
import type { TerrainHeightmapMeta } from '../data/terrain.ts';
import { DRIFT_SPEED, GUST_PERIOD_SECONDS, WIND_DIRECTION_XZ } from '../world/atmosphere/wind.ts';
import { bedrockZoneNode, erosionHeightNode, fissureNode } from '../world/terrain/erosion.ts';
import { quarryChannelsNode, quarryMaskNode, quarryOffsetNode } from '../world/terrain/quarry.ts';
import { duneHeightNode, PLATFORM_DAMPING } from '../world/terrain/relief.ts';
import { ridgeHeightNode } from '../world/terrain/ridges.ts';
import type { ShapedTerrain } from '../world/terrain/shape.ts';
import { SKIRT_DEPTH } from '../world/terrain/tiles.ts';

export const GROUND_PALETTE = {
	sandLight: 0xddb47c,
	sandDark: 0xc7915a,
	gravel: 0xb8a387,
	bedrockLight: 0xb9ae99,
	bedrockDark: 0x806f5b,
	quarryFace: 0xd8cbb0,
	quarryDebris: 0xcfb894,
	tafla: 0xa8957a,
	leeSand: 0xb4845a
} as const;

const WIND_DIRECTION = vec2(...WIND_DIRECTION_XZ);
const WIND_ACROSS = vec2(-WIND_DIRECTION_XZ[1], WIND_DIRECTION_XZ[0]);
const DRIFT_FADE_FAR = 900;
const RIPPLE_WAVELENGTH = 0.9;
const NORMAL_STEP = 1.5;
const BASE_NORMAL_STEP = 12;
const SERIR_SCALE = 120;
const HORIZON_BLEND = 2500;
const VALLEY_EDGE = [600, 2600] as const;
const REGIONAL_LEVEL = { desert: 68, valley: 20 } as const;

export interface GroundMaterial {
	material: MeshStandardNodeMaterial;
	texture: DataTexture;
}

export function heightTextureTransform(meta: TerrainHeightmapMeta): Vector4 {
	const x0 = meta.center.x - meta.halfExtent;
	const z0 = meta.center.z - meta.halfExtent;
	const scale = 1 / (meta.spacing * meta.size);
	return new Vector4(scale, (-x0 / meta.spacing + 0.5) / meta.size, scale, (-z0 / meta.spacing + 0.5) / meta.size);
}

function createHeightTexture(shaped: ShapedTerrain, meta: TerrainHeightmapMeta): DataTexture {
	const data = new Uint16Array(meta.size * meta.size * 2);
	for (let i = 0; i < meta.size * meta.size; i++) {
		data[i * 2] = DataUtils.toHalfFloat(shaped.heights[i]);
		data[i * 2 + 1] = DataUtils.toHalfFloat(shaped.platformWeight[i]);
	}
	const heightTexture = new DataTexture(data, meta.size, meta.size, RGFormat, HalfFloatType);
	heightTexture.magFilter = LinearFilter;
	heightTexture.minFilter = LinearFilter;
	heightTexture.wrapS = ClampToEdgeWrapping;
	heightTexture.wrapT = ClampToEdgeWrapping;
	heightTexture.generateMipmaps = false;
	heightTexture.needsUpdate = true;
	return heightTexture;
}

export function createGroundMaterial(shaped: ShapedTerrain, meta: TerrainHeightmapMeta): GroundMaterial {
	const heightTexture = createHeightTexture(shaped, meta);
	const transform = uniform(heightTextureTransform(meta));

	const sampleGround = (xz: Node<'vec2'>) =>
		texture(heightTexture, vec2(xz.x.mul(transform.x).add(transform.y), xz.y.mul(transform.z).add(transform.w))).level(
			float(0)
		);

	const squareCenter = vec2(meta.center.x, meta.center.z);
	const beyondAt = (xz: Node<'vec2'>) => {
		const offset = abs(xz.sub(squareCenter)).sub(meta.halfExtent);
		return smoothstep(0, HORIZON_BLEND, max(offset.x, offset.y));
	};
	const baseAt = (xz: Node<'vec2'>) => {
		const desert = oneMinus(smoothstep(VALLEY_EDGE[0], VALLEY_EDGE[1], xz.x));
		const regional = mix(float(REGIONAL_LEVEL.valley), float(REGIONAL_LEVEL.desert), desert).add(
			duneHeightNode(xz.mul(0.2)).mul(5).mul(desert)
		);
		return mix(sampleGround(xz).r, regional, beyondAt(xz));
	};
	const detailAt = (xz: Node<'vec2'>) => {
		const platformWeight = sampleGround(xz).g;
		return duneHeightNode(xz)
			.mul(oneMinus(platformWeight.mul(PLATFORM_DAMPING)))
			.add(ridgeHeightNode(xz, platformWeight))
			.add(quarryOffsetNode(xz))
			.mul(oneMinus(beyondAt(xz)));
	};
	const heightAt = (xz: Node<'vec2'>) => baseAt(xz).add(detailAt(xz));
	const slopeOf = (sample: (xz: Node<'vec2'>) => Node<'float'>, xz: Node<'vec2'>, step: number) =>
		vec2(
			sample(xz.add(vec2(step, 0))).sub(sample(xz.sub(vec2(step, 0)))),
			sample(xz.add(vec2(0, step))).sub(sample(xz.sub(vec2(0, step))))
		).div(step * 2);

	const material = new MeshStandardNodeMaterial({ roughness: 0.96, metalness: 0 });

	material.positionNode = Fn(() => {
		const world = modelWorldMatrix.mul(vec4(positionLocal, 1)).xz;
		return vec3(
			positionLocal.x,
			heightAt(world)
				.add(erosionHeightNode(world, sampleGround(world).g))
				.sub(attribute('skirt', 'float').mul(SKIRT_DEPTH)),
			positionLocal.z
		);
	})();

	const xz = positionWorld.xz;
	const platform = sampleGround(xz).g;
	const gradient = slopeOf(baseAt, xz, BASE_NORMAL_STEP).add(slopeOf(detailAt, xz, NORMAL_STEP));
	const terrainNormal = normalize(vec3(gradient.x.negate(), 1, gradient.y.negate()));

	const macro = mx_noise_float(vec3(xz.div(900), 0.3))
		.mul(0.5)
		.add(mx_noise_float(vec3(xz.div(180), 1.7)).mul(0.3))
		.add(mx_noise_float(vec3(xz.div(35), 4.1)).mul(0.2));
	const streaks = mx_noise_float(vec3(dot(xz, WIND_DIRECTION).div(260), dot(xz, WIND_ACROSS).div(28), 7.3));
	const slope = oneMinus(terrainNormal.y);
	const exposed = bedrockZoneNode(xz)
		.mul(oneMinus(platform).pow(2))
		.mul(smoothstep(-0.1, 0.18, macro).mul(0.75).add(0.2));
	const quarry = quarryMaskNode(xz);
	const steepRock = max(smoothstep(0.12, 0.3, slope), quarry.mul(smoothstep(0.035, 0.11, slope)));
	const rock = max(steepRock, exposed);
	const strata = sin(positionWorld.y.mul((Math.PI * 2) / 1.4).add(macro.mul(2)))
		.mul(0.5)
		.add(0.5);

	const sand = mix(color(GROUND_PALETTE.sandDark), color(GROUND_PALETTE.sandLight), saturate(macro.mul(0.5).add(0.5)))
		.mul(streaks.mul(0.05).add(1))
		.toVar();
	const downwind = dot(xz, WIND_DIRECTION).sub(time.mul(DRIFT_SPEED));
	const gust = sin(time.mul((Math.PI * 2) / GUST_PERIOD_SECONDS))
		.mul(0.5)
		.add(0.5);
	const drift = smoothstep(
		0.25,
		0.75,
		mx_noise_float(vec3(downwind.div(9), dot(xz, WIND_ACROSS).div(2.2), time.mul(0.15)))
	)
		.mul(oneMinus(smoothstep(80, DRIFT_FADE_FAR, distance(cameraPosition, positionWorld))))
		.mul(oneMinus(rock), oneMinus(platform), gust.mul(0.6).add(0.4));
	const drifting = sand.add(color(GROUND_PALETTE.sandLight).mul(drift.mul(0.09)));
	const lee = smoothstep(0.04, 0.22, dot(vec2(terrainNormal.x, terrainNormal.z), WIND_DIRECTION)).mul(oneMinus(rock));
	const serir = smoothstep(
		0.6,
		0.78,
		mx_noise_float(vec3(xz.div(SERIR_SCALE), 2.6))
			.mul(0.5)
			.add(0.5)
	).mul(oneMinus(platform));
	const textured = mix(
		mix(drifting, color(GROUND_PALETTE.leeSand), lee.mul(0.35)),
		color(GROUND_PALETTE.gravel).mul(0.85),
		serir.mul(0.4)
	);
	const packed = mix(textured, color(GROUND_PALETTE.gravel), platform.mul(0.55));
	const debris = mix(
		color(GROUND_PALETTE.quarryDebris),
		color(GROUND_PALETTE.tafla),
		smoothstep(0.45, 0.75, mx_noise_float(vec3(xz.div(26), 5.3)))
	).mul(macro.mul(0.08).add(1));
	const floorCover = quarry.mul(
		smoothstep(-0.2, 0.35, mx_noise_float(vec3(xz.div(60), 9.1)))
			.mul(0.4)
			.add(0.1)
	);
	const quarried = mix(packed, debris, floorCover);
	const bedrockPattern = mix(
		saturate(macro.mul(0.5).add(0.5)),
		saturate(strata.mul(0.6).add(macro.mul(0.25)).add(0.2)),
		steepRock
	);
	const weathered = mix(color(GROUND_PALETTE.bedrockDark), color(GROUND_PALETTE.bedrockLight), bedrockPattern);
	const bedrock = mix(
		weathered,
		color(GROUND_PALETTE.quarryFace).mul(bedrockPattern.mul(0.25).add(0.8)),
		quarry.mul(0.4)
	);
	const viewDistance = distance(cameraPosition, positionWorld);
	const channel = quarryChannelsNode(xz, viewDistance);
	const fissure = fissureNode(xz).mul(oneMinus(smoothstep(30, 220, distance(cameraPosition, positionWorld))));
	material.colorNode = mix(quarried, bedrock.mul(oneMinus(fissure.mul(0.35))), rock).mul(oneMinus(channel.mul(0.28)));
	material.roughnessNode = mix(float(0.97), float(0.88), rock);

	const rippleFade = oneMinus(smoothstep(10, 65, distance(cameraPosition, positionWorld)))
		.mul(oneMinus(rock))
		.mul(oneMinus(platform));
	const ripplePhase = dot(xz, WIND_DIRECTION)
		.mul((Math.PI * 2) / RIPPLE_WAVELENGTH)
		.add(mx_noise_float(vec3(xz.mul(0.05), 2.2)).mul(6));
	const ripple = sin(ripplePhase).mul(0.09).mul(rippleFade);
	const shadedNormal = normalize(
		terrainNormal.add(vec3(WIND_DIRECTION.x.mul(ripple), 0, WIND_DIRECTION.y.mul(ripple)))
	);
	material.normalNode = normalize(cameraViewMatrix.mul(vec4(shadedNormal, 0)).xyz);

	return { material, texture: heightTexture };
}
