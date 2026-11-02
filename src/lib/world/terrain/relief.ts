import { float, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { sampleHeight, type TerrainHeightmapMeta } from '../../data/terrain.ts';
import { erosionHeight } from './erosion.ts';
import { valueNoise, valueNoiseNode } from './noise.ts';
import { quarryOffset } from './quarry.ts';
import type { ShapedTerrain } from './shape.ts';

export const PLATFORM_DAMPING = 0.85;

const OCTAVES = [
	{ wavelength: 220, amplitude: 1.6, shiftX: 0, shiftZ: 0 },
	{ wavelength: 57, amplitude: 0.5, shiftX: 17.3, shiftZ: -4.1 }
] as const;

export function duneHeight(x: number, z: number): number {
	let total = 0;
	for (const octave of OCTAVES) {
		total +=
			(valueNoise(x / octave.wavelength + octave.shiftX, z / octave.wavelength + octave.shiftZ) - 0.5) *
			octave.amplitude;
	}
	return total;
}

export function createGroundSampler(
	shaped: ShapedTerrain,
	meta: TerrainHeightmapMeta
): (x: number, z: number) => number {
	return (x, z) => {
		const platform = sampleHeight(shaped.platformWeight, meta, x, z);
		const surface = sampleHeight(shaped.heights, meta, x, z) + duneHeight(x, z) * (1 - PLATFORM_DAMPING * platform);
		return surface + quarryOffset(x, z) + erosionHeight(x, z, platform);
	};
}

export function duneHeightNode(xz: Node<'vec2'>): Node<'float'> {
	let total: Node<'float'> = float(0);
	for (const octave of OCTAVES) {
		const point = xz.div(octave.wavelength).add(vec2(octave.shiftX, octave.shiftZ));
		total = total.add(valueNoiseNode(point).sub(0.5).mul(octave.amplitude));
	}
	return total;
}
