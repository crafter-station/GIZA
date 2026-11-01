import type { Footprint } from '../../data/layout.ts';
import { sampleHeight, type TerrainHeightmapMeta } from '../../data/terrain.ts';

export interface ShapedTerrain {
	heights: Float32Array;
	platformWeight: Float32Array;
	platforms: number[];
}

const RING_SAMPLES = 64;
const BLEND_METERS = 60;

function ringMedian(heights: Float32Array, meta: TerrainHeightmapMeta, footprint: Footprint): number {
	const values: number[] = [];
	for (let i = 0; i < RING_SAMPLES; i++) {
		const angle = (i / RING_SAMPLES) * Math.PI * 2;
		const radius = Math.max(footprint.halfX, footprint.halfZ) + BLEND_METERS;
		values.push(
			sampleHeight(heights, meta, footprint.x + Math.cos(angle) * radius, footprint.z + Math.sin(angle) * radius)
		);
	}
	values.sort((a, b) => a - b);
	return values[values.length >> 1];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
	return t * t * (3 - 2 * t);
}

export function flattenFootprints(
	source: Float32Array,
	meta: TerrainHeightmapMeta,
	footprints: readonly Footprint[]
): ShapedTerrain {
	const heights = new Float32Array(source);
	const platformWeight = new Float32Array(source.length);
	const platforms = footprints.map((footprint) => ringMedian(source, meta, footprint));
	const originX = meta.center.x - meta.halfExtent;
	const originZ = meta.center.z - meta.halfExtent;
	for (let row = 0; row < meta.size; row++) {
		for (let col = 0; col < meta.size; col++) {
			const x = originX + col * meta.spacing;
			const z = originZ + row * meta.spacing;
			const index = row * meta.size + col;
			footprints.forEach((footprint, i) => {
				const outside = Math.max(
					Math.abs(x - footprint.x) - footprint.halfX,
					Math.abs(z - footprint.z) - footprint.halfZ
				);
				const weight = 1 - smoothstep(0, BLEND_METERS, outside);
				if (weight <= 0) return;
				heights[index] += (platforms[i] - heights[index]) * weight;
				platformWeight[index] = Math.max(platformWeight[index], weight);
			});
		}
	}
	return { heights, platformWeight, platforms };
}
