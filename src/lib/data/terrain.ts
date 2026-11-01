export interface MonumentCheck {
	expected: { x: number; z: number };
	peak: { x: number; z: number; height: number };
	offset: number;
	prominence: number;
}

export interface TerrainHeightmapMeta {
	version: 1;
	file: string;
	size: number;
	center: { x: number; z: number };
	halfExtent: number;
	spacing: number;
	minHeight: number;
	maxHeight: number;
	verticalDatum: 'EGM2008';
	origin: { lat: number; lon: number };
	surfaceModel: true;
	source: {
		product: string;
		tile: string;
		attribution: string;
		license: string;
	};
	verification: Record<string, MonumentCheck>;
}

export function decodeHeights(samples: Uint16Array, meta: TerrainHeightmapMeta): Float32Array {
	const out = new Float32Array(samples.length);
	const range = (meta.maxHeight - meta.minHeight) / 65535;
	for (let i = 0; i < samples.length; i++) out[i] = meta.minHeight + samples[i] * range;
	return out;
}

export function sampleHeight(heights: Float32Array, meta: TerrainHeightmapMeta, x: number, z: number): number {
	const n = meta.size;
	const fx = Math.min(Math.max((x - meta.center.x + meta.halfExtent) / meta.spacing, 0), n - 1);
	const fz = Math.min(Math.max((z - meta.center.z + meta.halfExtent) / meta.spacing, 0), n - 1);
	const x0 = Math.min(Math.floor(fx), n - 2);
	const z0 = Math.min(Math.floor(fz), n - 2);
	const tx = fx - x0;
	const tz = fz - z0;
	const i = z0 * n + x0;
	const top = heights[i] * (1 - tx) + heights[i + 1] * tx;
	const bottom = heights[i + n] * (1 - tx) + heights[i + n + 1] * tx;
	return top * (1 - tz) + bottom * tz;
}
