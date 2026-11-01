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
import { duneHeightNode, PLATFORM_DAMPING } from '../world/terrain/relief.ts';
import type { ShapedTerrain } from '../world/terrain/shape.ts';
import { SKIRT_DEPTH } from '../world/terrain/tiles.ts';

export const GROUND_PALETTE = {
	sandLight: 0xddb47c,
	sandDark: 0xc7915a,
	gravel: 0xb8a387,
	bedrockLight: 0xd2b688,
	bedrockDark: 0xa98b62
} as const;

const WIND_DIRECTION = vec2(0.34, 0.94).normalize();
const WIND_ACROSS = vec2(-0.94, 0.34);
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
	const heightAt = (xz: Node<'vec2'>) => {
		const ground = sampleGround(xz);
		const measured = ground.r.add(duneHeightNode(xz).mul(oneMinus(ground.g.mul(PLATFORM_DAMPING))));
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
	const left = heightAt(xz.sub(vec2(NORMAL_STEP, 0)));
	const right = heightAt(xz.add(vec2(NORMAL_STEP, 0)));
	const north = heightAt(xz.sub(vec2(0, NORMAL_STEP)));
	const south = heightAt(xz.add(vec2(0, NORMAL_STEP)));
	const terrainNormal = normalize(vec3(left.sub(right), float(NORMAL_STEP * 2), north.sub(south)));

	const macro = mx_noise_float(vec3(xz.div(900), 0.3))
		.mul(0.5)
		.add(mx_noise_float(vec3(xz.div(180), 1.7)).mul(0.3))
		.add(mx_noise_float(vec3(xz.div(35), 4.1)).mul(0.2));
	const streaks = mx_noise_float(vec3(dot(xz, WIND_DIRECTION).div(260), dot(xz, WIND_ACROSS).div(28), 7.3));
	const slope = oneMinus(terrainNormal.y);
	const rock = smoothstep(0.12, 0.3, slope);
	const strata = sin(positionWorld.y.mul((Math.PI * 2) / 1.4).add(macro.mul(2)))
		.mul(0.5)
		.add(0.5);

	const sand = mix(color(GROUND_PALETTE.sandDark), color(GROUND_PALETTE.sandLight), saturate(macro.mul(0.5).add(0.5)))
		.mul(streaks.mul(0.05).add(1))
		.toVar();
	const packed = mix(sand, color(GROUND_PALETTE.gravel), platform.mul(0.55));
	const bedrock = mix(
		color(GROUND_PALETTE.bedrockDark),
		color(GROUND_PALETTE.bedrockLight),
		saturate(strata.mul(0.6).add(macro.mul(0.25)).add(0.2))
	);
	material.colorNode = mix(packed, bedrock, rock);
	material.roughnessNode = mix(float(0.97), float(0.88), rock);

	const rippleFade = oneMinus(smoothstep(25, 140, distance(cameraPosition, positionWorld)))
		.mul(oneMinus(rock))
		.mul(oneMinus(platform));
	const ripplePhase = dot(xz, WIND_DIRECTION)
		.mul((Math.PI * 2) / RIPPLE_WAVELENGTH)
		.add(mx_noise_float(vec3(xz.mul(0.05), 2.2)).mul(6));
	const ripple = sin(ripplePhase).mul(0.25).mul(rippleFade);
	const shadedNormal = normalize(
		terrainNormal.add(vec3(WIND_DIRECTION.x.mul(ripple), 0, WIND_DIRECTION.y.mul(ripple)))
	);
	material.normalNode = normalize(cameraViewMatrix.mul(vec4(shadedNormal, 0)).xyz);

	return { material, texture: heightTexture };
}
