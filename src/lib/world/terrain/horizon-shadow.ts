import { abs, float, max, oneMinus, smoothstep, texture, uniform, vec2 } from 'three/tsl';
import {
	ClampToEdgeWrapping,
	DataTexture,
	DataUtils,
	HalfFloatType,
	LinearFilter,
	type Node,
	RedFormat,
	type Vector3
} from 'three/webgpu';
import type { TerrainHeightmapMeta } from '../../data/terrain.ts';
import { heightTextureTransform } from '../../materials/ground.ts';
import type { HorizonRequest, HorizonResult } from './horizon.ts';

const PENUMBRA = 0.025;
const EDGE_FADE = 300;
const AZIMUTH_TOLERANCE = Math.cos((1 * Math.PI) / 180);
const LOWEST_SUN = -0.05;

export class HorizonShadow {
	private readonly worker: Worker;
	private readonly texture: DataTexture;
	private readonly data: Uint16Array;
	private readonly sunSlope = uniform(10);
	private readonly transform;
	private requested = { x: 0, z: 0 };
	private nextId = 0;
	private pendingId = -1;

	constructor(
		heights: Float32Array,
		private readonly meta: TerrainHeightmapMeta
	) {
		this.data = new Uint16Array(meta.size * meta.size).fill(DataUtils.toHalfFloat(-1));
		this.texture = new DataTexture(this.data, meta.size, meta.size, RedFormat, HalfFloatType);
		this.texture.magFilter = LinearFilter;
		this.texture.minFilter = LinearFilter;
		this.texture.wrapS = ClampToEdgeWrapping;
		this.texture.wrapT = ClampToEdgeWrapping;
		this.texture.generateMipmaps = false;
		this.texture.needsUpdate = true;
		this.transform = uniform(heightTextureTransform(meta));
		this.worker = new Worker(new URL('./horizon.worker.ts', import.meta.url), { type: 'module' });
		this.worker.onmessage = (event: MessageEvent<HorizonResult>) => this.receive(event.data);
		this.worker.postMessage({ heights: heights.slice(), size: meta.size, spacing: meta.spacing });
	}

	update(sunDirection: Vector3): void {
		const horizontal = Math.hypot(sunDirection.x, sunDirection.z);
		this.sunSlope.value = horizontal < 1e-4 ? 10 : sunDirection.y / horizontal;
		if (sunDirection.y < LOWEST_SUN || horizontal < 1e-4 || this.pendingId >= 0) return;
		const x = sunDirection.x / horizontal;
		const z = sunDirection.z / horizontal;
		if (this.nextId > 0 && x * this.requested.x + z * this.requested.z > AZIMUTH_TOLERANCE) return;
		this.requested = { x, z };
		this.pendingId = this.nextId++;
		const request: HorizonRequest = { id: this.pendingId, directionX: x, directionZ: z };
		this.worker.postMessage(request);
	}

	factor(xz: Node<'vec2'>): Node<'float'> {
		const uv = vec2(xz.x.mul(this.transform.x).add(this.transform.y), xz.y.mul(this.transform.z).add(this.transform.w));
		const horizon = texture(this.texture, uv).level(float(0)).r;
		const lit = smoothstep(-PENUMBRA, PENUMBRA, this.sunSlope.sub(horizon));
		const center = vec2(this.meta.center.x, this.meta.center.z);
		const offset = abs(xz.sub(center)).sub(this.meta.halfExtent);
		const inside = oneMinus(smoothstep(-EDGE_FADE, 0, max(offset.x, offset.y)));
		return lit.mul(inside).add(oneMinus(inside));
	}

	private receive(result: HorizonResult): void {
		if (result.id !== this.pendingId) return;
		this.pendingId = -1;
		for (let i = 0; i < result.slopes.length; i++) this.data[i] = DataUtils.toHalfFloat(result.slopes[i]);
		this.texture.needsUpdate = true;
	}

	dispose(): void {
		this.worker.terminate();
		this.texture.dispose();
	}
}
