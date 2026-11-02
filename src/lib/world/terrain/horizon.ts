export interface HorizonGrid {
	heights: Float32Array;
	size: number;
	spacing: number;
}

export interface HorizonRequest {
	id: number;
	directionX: number;
	directionZ: number;
}

export interface HorizonResult {
	id: number;
	slopes: Float32Array;
}

export const HORIZON_REACH = 4000;
const STEP_FRACTION = 0.75;
const SELF_SHADOW_BIAS = 0.6;
const NO_HORIZON = -1;

function sample(grid: HorizonGrid, fx: number, fz: number): number {
	const n = grid.size;
	const x0 = Math.floor(fx);
	const z0 = Math.floor(fz);
	const tx = fx - x0;
	const tz = fz - z0;
	const i = z0 * n + x0;
	const h = grid.heights;
	const top = h[i] + (h[i + 1] - h[i]) * tx;
	const bottom = h[i + n] + (h[i + n + 1] - h[i + n]) * tx;
	return top + (bottom - top) * tz;
}

export function horizonSlopes(grid: HorizonGrid, directionX: number, directionZ: number): Float32Array {
	const n = grid.size;
	const length = Math.hypot(directionX, directionZ) || 1;
	const dx = directionX / length;
	const dz = directionZ / length;
	const step = grid.spacing * STEP_FRACTION;
	const steps = Math.ceil(HORIZON_REACH / step);
	const slopes = new Float32Array(n * n).fill(NO_HORIZON);
	for (let iz = 0; iz < n; iz++) {
		for (let ix = 0; ix < n; ix++) {
			const origin = grid.heights[iz * n + ix] + SELF_SHADOW_BIAS;
			let best = NO_HORIZON;
			for (let s = 1; s <= steps; s++) {
				const distance = s * step;
				const fx = ix + (dx * distance) / grid.spacing;
				const fz = iz + (dz * distance) / grid.spacing;
				if (fx < 0 || fz < 0 || fx > n - 2 || fz > n - 2) break;
				const slope = (sample(grid, fx, fz) - origin) / distance;
				if (slope > best) best = slope;
			}
			slopes[iz * n + ix] = best;
		}
	}
	return slopes;
}
