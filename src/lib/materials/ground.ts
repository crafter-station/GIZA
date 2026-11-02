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
	If,
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
import { cloudShadow } from '../world/atmosphere/clouds.ts';
import { DRIFT_SPEED, GUST_PERIOD_SECONDS, WIND_DIRECTION_XZ } from '../world/atmosphere/wind.ts';
import { bedrockZoneNode, erosionHeightNode, fissureNode } from '../world/terrain/erosion.ts';
import { signedNoiseNode } from '../world/terrain/noise.ts';
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
const CHANNEL_FAR = 300;
const FISSURE_FAR = 220;
const RIPPLE_FAR = 65;
const SERIR_SCALE = 120;
const HORIZON_BLEND = 2500;
const VALLEY_EDGE = [600, 2600] as const;
const REGIONAL_LEVEL = { desert: 68, valley: 20 } as const;

export interface GroundMaterial {
	material: MeshStandardNodeMaterial;
	texture: DataTexture;
	detailFar: { value: number };
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

export function createGroundMaterial(
	shaped: ShapedTerrain,
	meta: TerrainHeightmapMeta,
	horizonLight: (xz: Node<'vec2'>) => Node<'float'>
): GroundMaterial {
	const heightTexture = createHeightTexture(shaped, meta);
	const transform = uniform(heightTextureTransform(meta));
	const detailFar = uniform(1600);

	const sampleGround = (xz: Node<'vec2'>) =>
		texture(heightTexture, vec2(xz.x.mul(transform.x).add(transform.y), xz.y.mul(transform.z).add(transform.w))).level(
			float(0)
		);

	const squareCenter = vec2(meta.center.x, meta.center.z);
	const beyondAt = (xz: Node<'vec2'>) => {
		const offset = abs(xz.sub(squareCenter)).sub(meta.halfExtent);
		return smoothstep(0, HORIZON_BLEND, max(offset.x, offset.y));
	};
	const baseAt = Fn(([xz]: [Node<'vec2'>]) => {
		const height = sampleGround(xz).r.toVar();
		const beyond = beyondAt(xz);
		If(beyond.greaterThan(0), () => {
			const desert = oneMinus(smoothstep(VALLEY_EDGE[0], VALLEY_EDGE[1], xz.x));
			const regional = mix(float(REGIONAL_LEVEL.valley), float(REGIONAL_LEVEL.desert), desert).add(
				duneHeightNode(xz.mul(0.2)).mul(5).mul(desert)
			);
			height.assign(mix(height, regional, beyond));
		});
		return height;
	});
	const detailAt = (xz: Node<'vec2'>) => {
		const platformWeight = sampleGround(xz).g;
		return duneHeightNode(xz)
			.mul(oneMinus(platformWeight.mul(PLATFORM_DAMPING)))
			.add(ridgeHeightNode(xz, platformWeight))
			.add(quarryOffsetNode(xz))
			.mul(oneMinus(beyondAt(xz)));
	};
	const heightAt = (xz: Node<'vec2'>) => baseAt(xz).add(detailAt(xz));

	const material = new MeshStandardNodeMaterial({ roughness: 0.96, metalness: 0 });
	const receiveShadow = Fn(([shadow]: [Node<'float'>]) => shadow.mul(horizonLight(positionWorld.xz)));
	material.receivedShadowNode = receiveShadow as unknown as () => Node;

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
	const viewDistance = distance(cameraPosition, positionWorld);
	const platform = sampleGround(xz).g;
	const terrainNormal = Fn(() => {
		const base = baseAt(xz);
		const gradient = vec2(
			baseAt(xz.add(vec2(BASE_NORMAL_STEP, 0))).sub(base),
			baseAt(xz.add(vec2(0, BASE_NORMAL_STEP))).sub(base)
		)
			.div(BASE_NORMAL_STEP)
			.toVar();
		If(viewDistance.lessThan(detailFar), () => {
			const detail = detailAt(xz);
			const detailSlope = vec2(
				detailAt(xz.add(vec2(NORMAL_STEP, 0))).sub(detail),
				detailAt(xz.add(vec2(0, NORMAL_STEP))).sub(detail)
			).div(NORMAL_STEP);
			gradient.addAssign(detailSlope.mul(oneMinus(smoothstep(detailFar.mul(0.75), detailFar, viewDistance))));
		});
		return normalize(vec3(gradient.x.negate(), 1, gradient.y.negate()));
	})();

	const macro = signedNoiseNode(xz.div(900), 0.3)
		.mul(0.5)
		.add(signedNoiseNode(xz.div(180), 1.7).mul(0.3))
		.add(signedNoiseNode(xz.div(35), 4.1).mul(0.2));
	const streaks = signedNoiseNode(vec2(dot(xz, WIND_DIRECTION).div(260), dot(xz, WIND_ACROSS).div(28)), 7.3);
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

	const sand = mix(
		color(GROUND_PALETTE.sandDark),
		color(GROUND_PALETTE.sandLight),
		saturate(macro.mul(0.5).add(0.5))
	).mul(streaks.mul(0.05).add(1));
	const drift = Fn(() => {
		const amount = float(0).toVar();
		If(viewDistance.lessThan(DRIFT_FADE_FAR), () => {
			const downwind = dot(xz, WIND_DIRECTION).sub(time.mul(DRIFT_SPEED));
			const gust = sin(time.mul((Math.PI * 2) / GUST_PERIOD_SECONDS))
				.mul(0.5)
				.add(0.5);
			amount.assign(
				smoothstep(0.25, 0.75, mx_noise_float(vec3(downwind.div(9), dot(xz, WIND_ACROSS).div(2.2), time.mul(0.15))))
					.mul(oneMinus(smoothstep(80, DRIFT_FADE_FAR, viewDistance)))
					.mul(oneMinus(rock), oneMinus(platform), gust.mul(0.6).add(0.4))
			);
		});
		return amount;
	})();
	const drifting = sand.add(color(GROUND_PALETTE.sandLight).mul(drift.mul(0.09)));
	const lee = smoothstep(0.04, 0.22, dot(vec2(terrainNormal.x, terrainNormal.z), WIND_DIRECTION)).mul(oneMinus(rock));
	const serir = smoothstep(0.6, 0.78, signedNoiseNode(xz.div(SERIR_SCALE), 2.6).mul(0.5).add(0.5)).mul(
		oneMinus(platform)
	);
	const textured = mix(
		mix(drifting, color(GROUND_PALETTE.leeSand), lee.mul(0.35)),
		color(GROUND_PALETTE.gravel).mul(0.85),
		serir.mul(0.4)
	);
	const packed = mix(textured, color(GROUND_PALETTE.gravel), platform.mul(0.55));
	const quarried = Fn(() => {
		const surface = vec3(packed).toVar();
		If(quarry.greaterThan(0), () => {
			const debris = mix(
				color(GROUND_PALETTE.quarryDebris),
				color(GROUND_PALETTE.tafla),
				smoothstep(0.45, 0.75, signedNoiseNode(xz.div(26), 5.3))
			).mul(macro.mul(0.08).add(1));
			const floorCover = quarry.mul(
				smoothstep(-0.2, 0.35, signedNoiseNode(xz.div(60), 9.1))
					.mul(0.4)
					.add(0.1)
			);
			surface.assign(mix(surface, debris, floorCover));
		});
		return surface;
	})();
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
	const nearDetail = Fn(() => {
		const darkening = vec2(0, 0).toVar();
		If(viewDistance.lessThan(CHANNEL_FAR).and(quarry.greaterThan(0)), () => {
			darkening.x.assign(quarryChannelsNode(xz, viewDistance));
		});
		If(viewDistance.lessThan(FISSURE_FAR), () => {
			darkening.y.assign(fissureNode(xz).mul(oneMinus(smoothstep(30, FISSURE_FAR, viewDistance))));
		});
		return darkening;
	})();
	material.colorNode = mix(quarried, bedrock.mul(oneMinus(nearDetail.y.mul(0.35))), rock)
		.mul(oneMinus(nearDetail.x.mul(0.28)))
		.mul(cloudShadow(positionWorld));
	material.roughnessNode = mix(float(0.97), float(0.88), rock);

	const ripple = Fn(() => {
		const amount = float(0).toVar();
		If(viewDistance.lessThan(RIPPLE_FAR), () => {
			const rippleFade = oneMinus(smoothstep(10, RIPPLE_FAR, viewDistance))
				.mul(oneMinus(rock))
				.mul(oneMinus(platform));
			const ripplePhase = dot(xz, WIND_DIRECTION)
				.mul((Math.PI * 2) / RIPPLE_WAVELENGTH)
				.add(signedNoiseNode(xz.mul(0.05), 2.2).mul(6));
			amount.assign(sin(ripplePhase).mul(0.09).mul(rippleFade));
		});
		return amount;
	})();
	const shadedNormal = normalize(
		terrainNormal.add(vec3(WIND_DIRECTION.x.mul(ripple), 0, WIND_DIRECTION.y.mul(ripple)))
	);
	material.normalNode = normalize(cameraViewMatrix.mul(vec4(shadedNormal, 0)).xyz);

	return { material, texture: heightTexture, detailFar };
}
