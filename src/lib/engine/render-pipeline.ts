import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { godrays } from 'three/addons/tsl/display/GodraysNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import {
	builtinAOContext,
	cameraFar,
	cameraNear,
	cos,
	dot,
	float,
	hash,
	mix,
	mrt,
	normalView,
	output,
	pass,
	perspectiveDepthToViewZ,
	renderOutput,
	screenCoordinate,
	screenUV,
	sin,
	smoothstep,
	time,
	uniform,
	vec2,
	vec3,
	vec4,
	velocity
} from 'three/tsl';
import {
	AgXToneMapping,
	HalfFloatType,
	type Node,
	type PerspectiveCamera,
	RenderPipeline,
	type Scene,
	SRGBColorSpace,
	Vector3,
	type WebGPURenderer
} from 'three/webgpu';
import type { Tier } from '../app/quality.ts';
import type { Environment } from '../world/atmosphere/environment.ts';
import {
	createSunUniforms,
	ExposureAdaptation,
	filmGrain,
	photographicCurve,
	SunTracker,
	sunFlareNode
} from './photographic.ts';

const SHIMMER_NEAR = 700;
const SHIMMER_FAR = 3500;
const SHIMMER_AMPLITUDE = 0.0011;
const GRAIN_AMOUNT = 0.035;
const SUN_REFERENCE = 3.4;
const BLOOM_INPUT_LIMIT = 8;

export class AtmospherePipeline {
	private readonly pipeline: RenderPipeline;
	private readonly scenePass;
	private readonly prePass;
	private readonly ambientOcclusion;
	private readonly rays;
	private readonly glow;
	private readonly temporal;
	private readonly exposure = uniform(1);
	private readonly warmth = uniform(0);
	private readonly saturation = uniform(1);
	private readonly rayStrength = uniform(0);
	private readonly heat = uniform(0);
	private readonly contrast = uniform(1);
	private readonly grain = uniform(0);
	private readonly sun = createSunUniforms();
	private readonly sunTracker = new SunTracker();
	private readonly adaptation = new ExposureAdaptation();
	private readonly rayColor = uniform(new Vector3(1, 0.85, 0.7));
	private lastT = -1;
	private width = 0;
	private height = 0;

	constructor(
		renderer: WebGPURenderer,
		scene: Scene,
		private readonly camera: PerspectiveCamera,
		private readonly environment: Environment,
		tier: Tier,
		noAo: boolean
	) {
		const temporal = tier === 'high' || tier === 'ultra';
		this.grain.value = tier === 'low' ? 0 : GRAIN_AMOUNT;
		renderer.toneMapping = AgXToneMapping;
		renderer.toneMappingExposure = 1;
		renderer.outputColorSpace = SRGBColorSpace;
		this.scenePass = pass(scene, camera, { type: HalfFloatType, samples: temporal || tier === 'low' ? 0 : 4 });
		this.prePass = !noAo && tier !== 'low' ? pass(scene, camera, { type: HalfFloatType, samples: 0 }) : null;
		if (this.prePass) this.prePass.setMRT(mrt({ output: normalView }));
		this.ambientOcclusion = this.prePass
			? ao(this.prePass.getTextureNode('depth'), this.prePass.getTextureNode(), camera)
			: null;
		if (this.ambientOcclusion) {
			this.ambientOcclusion.resolutionScale = 0.5;
			this.ambientOcclusion.radius.value = 4;
			this.ambientOcclusion.thickness.value = 2;
			this.scenePass.contextNode = builtinAOContext(this.ambientOcclusion.getTextureNode().sample(screenUV).r);
		}
		if (temporal) this.scenePass.setMRT(mrt({ output, velocity }));
		const depth = this.scenePass.getTextureNode('depth');
		const distance = perspectiveDepthToViewZ(depth.sample(screenUV).r, cameraNear, cameraFar).negate();
		const shimmer = smoothstep(SHIMMER_NEAR, SHIMMER_FAR, distance).mul(this.heat, SHIMMER_AMPLITUDE);
		const wave = vec2(
			sin(
				screenUV.y
					.mul(820)
					.add(time.mul(5.3))
					.add(sin(screenUV.x.mul(37).add(time)).mul(2))
			),
			cos(screenUV.y.mul(610).sub(time.mul(4.1))).mul(0.5)
		);
		const beauty = this.scenePass.getTextureNode().sample(screenUV.add(wave.mul(shimmer)));
		this.rays = temporal ? godrays(depth, this.camera, environment.shafts) : null;
		let hdr: Node<'vec4'> = vec4(beauty.rgb.add(sunFlareNode(this.sun, depth)), beauty.a);
		if (this.rays) {
			this.rays.resolutionScale = 0.5;
			this.rays.raymarchSteps.value = tier === 'ultra' ? 32 : 20;
			this.rays.density.value = 0.006;
			this.rays.maxDensity.value = 0.25;
			hdr = vec4(hdr.rgb.add(this.rays.getTextureNode().rgb.mul(this.rayStrength, this.rayColor)), hdr.a);
		}
		this.glow = bloom(vec4(hdr.rgb.min(vec3(BLOOM_INPUT_LIMIT)), 1), 0.09, 0.45, 2);
		this.glow.setResolutionScale(0.5);
		hdr = vec4(hdr.rgb.add(this.glow.rgb), 1);
		this.temporal = temporal ? traa(hdr, depth, this.scenePass.getTextureNode('velocity'), this.camera) : null;
		const resolved = this.temporal ?? hdr;
		const tint = vec3(float(1).add(this.warmth), 1, float(1).sub(this.warmth));
		const graded = resolved.rgb.mul(tint, this.exposure);
		const luminance = dot(graded, vec3(0.2126, 0.7152, 0.0722));
		const saturated = mix(vec3(luminance), graded, this.saturation);
		const vignette = screenUV.sub(0.5).length().smoothstep(0.3, 0.8).mul(0.12).oneMinus();
		const toned = renderOutput(vec4(saturated.mul(vignette), 1), AgXToneMapping, SRGBColorSpace);
		const mapped = filmGrain(photographicCurve(toned.rgb, this.contrast), this.grain);
		const seed = screenCoordinate.x.add(screenCoordinate.y.mul(4096)).toUint();
		const dither = hash(seed).sub(0.5).div(255);
		this.pipeline = new RenderPipeline(renderer, vec4(mapped.add(dither).clamp(0, 1), 1));
		this.pipeline.outputColorTransform = false;
	}

	async warmup(renderer: WebGPURenderer): Promise<void> {
		await this.prePass?.compileAsync(renderer);
		await this.scenePass.compileAsync(renderer);
		this.render(0);
	}

	resetHistory(): void {
		this.adaptation.reset();
		if (this.temporal)
			(this.temporal as typeof this.temporal & { setSize(width: number, height: number): void }).setSize(1, 1);
	}

	resize(width: number, height: number): void {
		if (width !== this.width || height !== this.height) this.resetHistory();
		this.width = width;
		this.height = height;
	}

	render(t: number): void {
		if (this.lastT >= 0 && Math.abs(t - this.lastT) > 0.4) this.resetHistory();
		this.lastT = t;
		const look = this.environment.look;
		this.exposure.value = this.adaptation.update(
			look,
			this.environment.sun.intensity,
			this.environment.sunDirection.y,
			performance.now()
		);
		this.contrast.value = look.contrast;
		this.sunTracker.update(this.camera, this.environment.sunDirection, this.sun, look);
		const sunColor = this.environment.sun.color;
		this.sun.color.value
			.set(sunColor.r, sunColor.g, sunColor.b)
			.multiplyScalar(look.sunIntensity / SUN_REFERENCE + 0.6);
		this.warmth.value = look.warmth;
		this.saturation.value = look.saturation;
		this.rayStrength.value = look.rayStrength;
		this.heat.value = look.heat;
		this.pipeline.render();
	}

	dispose(): void {
		this.pipeline.dispose();
		this.temporal?.dispose();
		this.glow.dispose();
		this.rays?.dispose();
		this.ambientOcclusion?.dispose();
		this.prePass?.dispose();
		this.scenePass.dispose();
	}
}
