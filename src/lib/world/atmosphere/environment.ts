import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import {
	cameraPosition,
	dot,
	Fn,
	float,
	fog,
	If,
	mix,
	positionWorld,
	smoothstep,
	uniform,
	vec3,
	vec4
} from 'three/tsl';
import {
	Color,
	type CubeRenderTarget,
	DirectionalLight,
	HemisphereLight,
	Mesh,
	MeshBasicNodeMaterial,
	type Node,
	type PerspectiveCamera,
	PMREMGenerator,
	Scene,
	SphereGeometry,
	Vector3,
	type WebGPURenderer
} from 'three/webgpu';
import type { Tier } from '../../app/quality.ts';
import { GIZA_ORIGIN } from '../../data/geo.ts';
import { advanceClouds, cloudDensity, cloudPlane, cloudState } from './clouds.ts';
import {
	celestialState,
	LIGHTING_LOOKS,
	type LightingMode,
	type LightingPreset,
	nearestPreset,
	sampleLighting
} from './lighting.ts';
import { dustPhaseRatio, SUN_HAZE_SHARE } from './scattering.ts';
import { StarField } from './stars.ts';

const REBAKE_HOURS = 0.75;
const CLOUD_BRIGHTNESS = 1.35;
const CLOUD_SUN_GLOW = 2.2;
const CLOUD_OPACITY = 0.75;
const REBAKE_INTERVAL_MS = 500;

export class Environment {
	readonly sun = new DirectionalLight(0xfff2df, 3.4);
	readonly shafts = new DirectionalLight(0xffffff, 0);
	readonly look = { ...LIGHTING_LOOKS.dawn };
	readonly sunDirection = new Vector3();
	private readonly moon = new DirectionalLight(0xc3d5ef, 0);
	private readonly hemisphere = new HemisphereLight(0xd6dbdc, 0xc2a07a, 0.7);
	private readonly fill = new DirectionalLight(0xc0cddd, 0.1);
	private readonly sky = new SkyMesh();
	private readonly environmentSky = new SkyMesh();
	private readonly skies = [this.sky, this.environmentSky];
	private readonly environmentScene = new Scene();
	private readonly pmrem: PMREMGenerator;
	private liveMap: CubeRenderTarget | null = null;
	private bakedPreset: LightingPreset | null = null;
	private bakedHour = Number.NEGATIVE_INFINITY;
	private bakedAt = Number.NEGATIVE_INFINITY;
	private readonly csm: CSMShadowNode;
	private readonly moonDisc = new Mesh(new SphereGeometry(1, 16, 12), new MeshBasicNodeMaterial({ color: 0xd9e5f2 }));
	private readonly stars = new StarField(GIZA_ORIGIN.lat);
	private readonly night = uniform(0);
	private readonly skyRadiance = uniform(0.18);
	private readonly haze = uniform(0);
	private readonly fogColor = uniform(new Color());
	private readonly density = uniform(0.0002);
	private readonly hazeSun = uniform(new Vector3(0, 1, 0));
	private readonly hazeSunShare = uniform(0);
	private cloudClock = -1;
	private lastMinute = -1;
	private lastFov = -1;
	private lastAspect = -1;
	private celestial = celestialState(LIGHTING_LOOKS.dawn.hour);
	private mode: LightingMode = 'tour';
	private previousT = -1;
	private disposed = false;

	constructor(
		private readonly scene: Scene,
		renderer: WebGPURenderer,
		private readonly camera: PerspectiveCamera,
		tier: Tier
	) {
		this.pmrem = new PMREMGenerator(renderer);
		this.csm = new CSMShadowNode(this.sun, { cascades: tier === 'low' ? 2 : 3, maxFar: 3500, lightMargin: 250 });
		this.csm.fade = true;
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.setScalar(tier === 'ultra' ? 2048 : tier === 'low' ? 512 : 1024);
		this.sun.shadow.normalBias = 0.4;
		this.sun.shadow.bias = -0.00015;
		this.sun.shadow.shadowNode = this.csm;
		this.shafts.castShadow = tier === 'high' || tier === 'ultra';
		this.shafts.shadow.mapSize.setScalar(512);
		Object.assign(this.shafts.shadow.camera, {
			left: -1500,
			right: 1500,
			top: 1500,
			bottom: -1500,
			near: 1,
			far: 7000
		});
		this.shafts.shadow.camera.updateProjectionMatrix();
		this.shafts.shadow.normalBias = 0.4;
		for (const sky of this.skies) {
			sky.scale.setScalar(16000);
			sky.cloudCoverage.value = 0;
			sky.cloudSpeed.value = 0;
			sky.rayleigh.value = 1;
			sky.material.fog = false;
			sky.material.depthWrite = false;
			const daylight = sky.material.colorNode as Node<'vec4'> | null;
			if (daylight) {
				const elevation = positionWorld.sub(cameraPosition).normalize().y.max(0);
				const nightSky = mix(vec3(0.022, 0.027, 0.045), vec3(0.009, 0.014, 0.03), elevation.sqrt());
				const radiance = daylight.rgb.mul(this.skyRadiance);
				const dust = this.fogColor.mul(dot(radiance, vec3(0.2126, 0.7152, 0.0722)).mul(1.35));
				const hazy = mix(radiance, dust, this.haze.mul(elevation.oneMinus().mul(0.5).add(0.5)));
				const view = positionWorld.sub(cameraPosition).normalize();
				const density = cloudDensity(cloudPlane(cameraPosition, view)).mul(smoothstep(0.015, 0.12, view.y));
				const skyLevel = dot(hazy, vec3(0.2126, 0.7152, 0.0722));
				const forward = dot(view, cloudState.sunDirection).max(0).pow(4);
				const cloudLight = vec3(skyLevel.mul(CLOUD_BRIGHTNESS)).add(dust.mul(forward.mul(CLOUD_SUN_GLOW)));
				const clouded = mix(hazy, cloudLight, density.mul(CLOUD_OPACITY));
				sky.material.colorNode = vec4(mix(clouded, nightSky.mul(density.mul(0.5).oneMinus()), this.night), 1);
			}
		}
		this.environmentSky.showSunDisc.value = false;
		this.environmentScene.add(this.environmentSky);
		this.moonDisc.material.fog = false;
		this.moonDisc.scale.setScalar(33);
		this.moonDisc.name = 'moon-disc';
		scene.add(
			this.sky,
			this.sun,
			this.sun.target,
			this.moon,
			this.moon.target,
			this.hemisphere,
			this.fill,
			this.fill.target,
			this.shafts,
			this.shafts.target,
			this.moonDisc,
			this.stars.mesh
		);
		scene.background = null;
		const scattered = this.fogColor.mul(
			float(1).sub(this.hazeSunShare).add(dustPhaseRatio(this.hazeSun).mul(this.hazeSunShare))
		);
		scene.fogNode = fog(
			scattered,
			Fn(() => {
				const ray = positionWorld.sub(cameraPosition);
				const vertical = ray.y.div(180).clamp(-30, 30).toVar();
				const integral = float(1).toVar();
				If(vertical.abs().greaterThan(0.001), () => {
					integral.assign(vertical.negate().exp().oneMinus().div(vertical));
				});
				const atCamera = cameraPosition.y.sub(20).div(-180).clamp(-30, 5).exp();
				return ray.length().mul(this.density, atCamera, integral).clamp(0, 20).negate().exp().oneMinus();
			})()
		);
		renderer.shadowMap.enabled = true;
	}

	setMode(mode: LightingMode): void {
		this.mode = mode;
		this.lastMinute = -1;
	}

	setQuality(tier: Tier): void {
		const size = tier === 'ultra' ? 2048 : tier === 'low' ? 512 : 1024;
		this.sun.shadow.mapSize.setScalar(size);
		for (const light of this.csm.lights) light.shadow?.mapSize.setScalar(size);
		this.shafts.castShadow = tier === 'high' || tier === 'ultra';
	}

	private bakeEnvironment(): void {
		this.liveMap = this.pmrem.fromScene(this.environmentScene, 0.04, 1, 20000, {
			size: 64,
			renderTarget: this.liveMap
		});
		this.scene.environment = this.liveMap.texture;
	}

	update(t: number, forceEnvironment = false): boolean {
		if (this.disposed) return false;
		const discontinuity = this.previousT >= 0 && Math.abs(t - this.previousT) > 0.4;
		this.previousT = t;
		sampleLighting(t, this.mode, this.look);
		const look = this.look;
		const minute = Math.round(look.hour * 60);
		if (minute !== this.lastMinute) {
			this.lastMinute = minute;
			this.celestial = celestialState(look.hour);
			this.sunDirection.fromArray(this.celestial.sunDirection);
		}
		const anchor = this.sun.target.position.copy(this.camera.position);
		anchor.y = 40;
		this.sun.position.copy(anchor).addScaledVector(this.sunDirection, 4000);
		this.sun.intensity = look.sunIntensity * Math.max(0, Math.min(this.celestial.sun.altitude / 3, 1));
		this.sun.color.setHex(look.sunColor);
		this.shafts.position.set(-280, 40, 380).addScaledVector(this.sunDirection, 4000);
		this.shafts.target.position.set(-280, 40, 380);
		this.moon.target.position.copy(anchor);
		this.moon.position.fromArray(this.celestial.moonDirection).multiplyScalar(4000).add(anchor);
		this.moon.intensity = look.night * 0.24 * Math.max(0, this.celestial.moonDirection[1]);
		this.fill.position.copy(anchor).addScaledVector(this.sunDirection, -2000);
		this.fill.position.y = 800;
		this.fill.target.position.copy(anchor);
		this.fill.intensity = 0.12 * (1 - look.night);
		this.hemisphere.intensity = look.hemisphereIntensity;
		this.night.value = look.night;
		this.skyRadiance.value = look.skyRadiance;
		this.haze.value = look.haze;
		this.density.value = look.fogDensity;
		this.fogColor.value.setHex(look.fogColor);
		this.hazeSun.value.copy(this.sunDirection);
		const clock = performance.now();
		if (this.cloudClock >= 0) advanceClouds(Math.min((clock - this.cloudClock) / 1000, 0.1));
		this.cloudClock = clock;
		cloudState.coverage.value = look.clouds;
		cloudState.sunDirection.value.copy(this.sunDirection);
		cloudState.daylight.value = Math.min(this.sun.intensity / Math.max(look.sunIntensity, 0.001), 1) * (1 - look.night);
		this.hazeSunShare.value =
			SUN_HAZE_SHARE * (1 - look.night) * Math.min(this.sun.intensity / Math.max(look.sunIntensity, 0.001), 1);
		for (const sky of this.skies) {
			sky.sunPosition.value.copy(this.sunDirection).multiplyScalar(450000);
			sky.turbidity.value = look.turbidity;
			sky.mieCoefficient.value = look.mie;
		}
		this.sky.position.copy(this.camera.position);
		this.moonDisc.position.fromArray(this.celestial.moonDirection).multiplyScalar(7000).add(this.camera.position);
		this.moonDisc.visible = look.night > 0.01 && this.celestial.moon.altitude > 0;
		this.moonDisc.material.color.setScalar(look.night * 2);
		this.stars.update(this.camera.position, this.celestial.date, GIZA_ORIGIN.lon, look.night);
		this.scene.environmentIntensity = look.environmentIntensity;
		if (this.csm.camera && (this.lastFov !== this.camera.fov || this.lastAspect !== this.camera.aspect)) {
			this.csm.updateFrustums();
			this.lastFov = this.camera.fov;
			this.lastAspect = this.camera.aspect;
		}
		const preset = nearestPreset(look);
		const now = performance.now();
		const stale = preset !== this.bakedPreset || Math.abs(look.hour - this.bakedHour) > REBAKE_HOURS;
		if (forceEnvironment || !this.liveMap || (stale && now - this.bakedAt > REBAKE_INTERVAL_MS)) {
			this.bakeEnvironment();
			this.bakedPreset = preset;
			this.bakedHour = look.hour;
			this.bakedAt = now;
		}
		return discontinuity;
	}

	dispose(): void {
		this.disposed = true;
		this.scene.environment = null;
		this.scene.fogNode = null;
		this.liveMap?.dispose();
		this.liveMap = null;
		this.pmrem.dispose();
		this.csm.dispose();
		for (const light of this.csm.lights) light.shadow?.dispose();
		this.sun.shadow.dispose();
		this.shafts.shadow.dispose();
		for (const object of [this.sky, this.environmentSky, this.moonDisc]) {
			object.removeFromParent();
			object.geometry.dispose();
			object.material.dispose();
		}
		for (const light of [this.sun, this.moon, this.fill, this.shafts]) {
			light.removeFromParent();
			light.target.removeFromParent();
		}
		this.hemisphere.removeFromParent();
		this.stars.mesh.removeFromParent();
		this.stars.dispose();
	}
}
