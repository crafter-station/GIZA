import { type PerspectiveCamera, Vector3 } from 'three/webgpu';
import { type HotspotMarker, hotspotMarkers } from '../app/state.ts';
import { BLOCK_TARGETS, type BlockTargetId } from '../data/block-targets.ts';
import { HOTSPOTS, type Hotspot, type HotspotAnchor } from '../data/hotspots.ts';

const SURFACE_OFFSET = 0.6;
const MAX_MARKER_DISTANCE = 2600;
const OCCLUSION_INTERVAL_MS = 100;
const OCCLUSION_SAMPLES = 32;
const OCCLUSION_END = 0.96;
const TERRAIN_CLEARANCE = 0.5;
const FLIGHT_SECONDS: readonly [number, number] = [1, 3.5];
const FLIGHT_SPEED = 700;
const DEG = Math.PI / 180;

export interface PyramidPlacement {
	id: BlockTargetId;
	position: Vector3;
}

interface Resolved {
	hotspot: Hotspot;
	number: number;
	anchor: Vector3;
	camera: Vector3;
}

export class HotspotTracker {
	private readonly resolved: Resolved[];
	private readonly projected = new Vector3();
	private readonly sample = new Vector3();
	private occlusion = new Map<string, boolean>();
	private occludedAt = Number.NEGATIVE_INFINITY;
	private published = '';

	constructor(
		private readonly pyramids: readonly PyramidPlacement[],
		private readonly groundAt: (x: number, z: number) => number
	) {
		this.resolved = HOTSPOTS.map((hotspot, index) => {
			const anchor = this.anchorOf(hotspot.anchor);
			const { distance, bearing, elevation } = hotspot.view;
			const camera = new Vector3(
				Math.sin(bearing * DEG) * Math.cos(elevation * DEG),
				Math.sin(elevation * DEG),
				-Math.cos(bearing * DEG) * Math.cos(elevation * DEG)
			)
				.multiplyScalar(distance)
				.add(anchor);
			camera.y = Math.max(camera.y, this.groundAt(camera.x, camera.z) + 4);
			return { hotspot, number: index + 1, anchor, camera };
		});
	}

	private anchorOf(anchor: HotspotAnchor): Vector3 {
		if (anchor.kind === 'ground') {
			return new Vector3(anchor.x, this.groundAt(anchor.x, anchor.z) + anchor.lift, anchor.z);
		}
		const pyramid = this.pyramids.find((candidate) => candidate.id === anchor.pyramid);
		const target = BLOCK_TARGETS[anchor.pyramid];
		const base = pyramid?.position ?? new Vector3();
		const reach = (target.baseSide / 2) * (1 - anchor.height / target.originalHeight) + SURFACE_OFFSET;
		return anchor.side === 'north'
			? new Vector3(base.x + anchor.along, base.y + anchor.height, base.z - reach)
			: new Vector3(base.x + reach, base.y + anchor.height, base.z + anchor.along);
	}

	flight(id: string, from: Vector3): { camera: Vector3; anchor: Vector3; seconds: number } | null {
		const entry = this.resolved.find((item) => item.hotspot.id === id);
		if (!entry) return null;
		const seconds = Math.min(
			Math.max(from.distanceTo(entry.camera) / FLIGHT_SPEED + FLIGHT_SECONDS[0], FLIGHT_SECONDS[0]),
			FLIGHT_SECONDS[1]
		);
		return { camera: entry.camera, anchor: entry.anchor, seconds };
	}

	private insidePyramid(point: Vector3): boolean {
		for (const pyramid of this.pyramids) {
			const target = BLOCK_TARGETS[pyramid.id];
			const height = point.y - pyramid.position.y;
			if (height < 0 || height > target.originalHeight) continue;
			const half = (target.baseSide / 2) * (1 - height / target.originalHeight);
			if (Math.abs(point.x - pyramid.position.x) < half && Math.abs(point.z - pyramid.position.z) < half) return true;
		}
		return false;
	}

	private occluded(eye: Vector3, anchor: Vector3): boolean {
		for (let i = 1; i < OCCLUSION_SAMPLES; i++) {
			const t = (i / OCCLUSION_SAMPLES) * OCCLUSION_END;
			this.sample.lerpVectors(eye, anchor, t);
			if (this.sample.y < this.groundAt(this.sample.x, this.sample.z) - TERRAIN_CLEARANCE) return true;
			if (this.insidePyramid(this.sample)) return true;
		}
		return false;
	}

	update(camera: PerspectiveCamera, width: number, height: number, visible: boolean, now: number): void {
		const markers: HotspotMarker[] = [];
		const refresh = now - this.occludedAt > OCCLUSION_INTERVAL_MS;
		if (refresh) this.occludedAt = now;
		if (visible) {
			for (const entry of this.resolved) {
				if (camera.position.distanceTo(entry.anchor) > MAX_MARKER_DISTANCE) continue;
				this.projected.copy(entry.anchor).project(camera);
				if (this.projected.z > 1 || Math.abs(this.projected.x) > 1 || Math.abs(this.projected.y) > 1) continue;
				if (refresh) this.occlusion.set(entry.hotspot.id, this.occluded(camera.position, entry.anchor));
				markers.push({
					id: entry.hotspot.id,
					number: entry.number,
					x: Math.round((this.projected.x * 0.5 + 0.5) * width),
					y: Math.round((0.5 - this.projected.y * 0.5) * height),
					occluded: this.occlusion.get(entry.hotspot.id) ?? false
				});
			}
		}
		const key = markers.map((marker) => `${marker.id}:${marker.x}:${marker.y}:${marker.occluded}`).join('|');
		if (key === this.published) return;
		this.published = key;
		hotspotMarkers.set(markers);
	}

	dispose(): void {
		this.occlusion = new Map();
		hotspotMarkers.set([]);
	}
}
