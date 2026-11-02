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
import { valueNoiseNode } from '../world/terrain/noise.ts';
import { duneHeightNode, PLATFORM_DAMPING } from '../world/terrain/relief.ts';
import type { ShapedTerrain } from '../world/terrain/shape.ts';
import { SKIRT_DEPTH } from '../world/terrain/tiles.ts';

export const GROUND_PALETTE = {
	sandLight: 0xddb47c,
	sandDark: 0xc7915a,
	gravel: 0xb8a387,
	bedrockLight: 0xb9ae99,
	bedrockDark: 0x806f5b
} as const;

const WIND_DIRECTION = vec2(...WIND_DIRECTION_XZ);
const WIND_ACROSS = vec2(-WIND_DIRECTION_XZ[1], WIND_DIRECTION_XZ[0]);
const DRIFT_FADE_FAR = 900;
const RIPPLE_WAVELENGTH = 0.9;
const NORMAL_STEP = 1.5;
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
	const heightAt = (xz: Node<'vec2'>, erosionWeight: Node<'float'> = float(1)) => {
		const ground = sampleGround(xz);
		const measured = ground.r
			.add(duneHeightNode(xz).mul(oneMinus(ground.g.mul(PLATFORM_DAMPING))))
			.add(erosionHeightNode(xz, ground.g).mul(erosionWeight));
		const offset = abs(xz.sub(squareCenter)).sub(meta.halfExtent);
		const beyond = smoothstep(0, HORIZON_BLEND, max(offset.x, offset.y));
		const desert = oneMinus(smoothstep(VALLEY_EDGE[0], VALLEY_EDGE[1], xz.x));
		const regional = mix(float(REGIONAL_LEVEL.valley), float(REGIONAL_LEVEL.desert), desert).add(
			duneHeightNode(xz.mul(0.2)).mul(5).mul(desert)
		);
		return mix(measured, regional, beyond);
	};

	const material = new MeshStandardNodeMaterial({ roughness: 0.96, metalness: 0 });

	material.positionNode = Fn(() => {
		const world = modelWorldMatrix.mul(vec4(positionLocal, 1)).xz;
		return vec3(positionLocal.x, heightAt(world).sub(attribute('skirt', 'float').mul(SKIRT_DEPTH)), positionLocal.z);
	})();

	const xz = positionWorld.xz;
	const platform = sampleGround(xz).g;
	const normalErosion = oneMinus(smoothstep(80, 260, distance(cameraPosition, positionWorld)));
	const left = heightAt(xz.sub(vec2(NORMAL_STEP, 0)), normalErosion);
	const right = heightAt(xz.add(vec2(NORMAL_STEP, 0)), normalErosion);
	const north = heightAt(xz.sub(vec2(0, NORMAL_STEP)), normalErosion);
	const south = heightAt(xz.add(vec2(0, NORMAL_STEP)), normalErosion);
	const terrainNormal = normalize(vec3(left.sub(right), float(NORMAL_STEP * 2), north.sub(south)));

	const macro = mx_noise_float(vec3(xz.div(900), 0.3))
		.mul(0.5)
		.add(mx_noise_float(vec3(xz.div(180), 1.7)).mul(0.3))
		.add(mx_noise_float(vec3(xz.div(35), 4.1)).mul(0.2));
	const streaks = mx_noise_float(vec3(dot(xz, WIND_DIRECTION).div(260), dot(xz, WIND_ACROSS).div(28), 7.3));
	const slope = oneMinus(terrainNormal.y);
	const exposed = bedrockZoneNode(xz)
		.mul(oneMinus(platform).pow(2))
		.mul(smoothstep(0.3, 0.72, valueNoiseNode(xz.div(120).add(vec2(8, -5)))).mul(0.75).add(0.2));
	const steepRock = smoothstep(0.12, 0.3, slope);
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
	const packed = mix(drifting, color(GROUND_PALETTE.gravel), platform.mul(0.55));
	const bedrockPattern = mix(
		saturate(macro.mul(0.5).add(0.5)),
		saturate(strata.mul(0.6).add(macro.mul(0.25)).add(0.2)),
		steepRock
	);
	const bedrock = mix(color(GROUND_PALETTE.bedrockDark), color(GROUND_PALETTE.bedrockLight), bedrockPattern);
	const fissure = fissureNode(xz).mul(oneMinus(smoothstep(30, 220, distance(cameraPosition, positionWorld))));
	material.colorNode = mix(packed, bedrock.mul(oneMinus(fissure.mul(0.35))), rock);
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
