import { type HorizonGrid, type HorizonRequest, type HorizonResult, horizonSlopes } from './horizon.ts';

let grid: HorizonGrid | null = null;

self.onmessage = (event: MessageEvent<HorizonGrid | HorizonRequest>) => {
	const data = event.data;
	if ('heights' in data) {
		grid = data;
		return;
	}
	if (!grid) return;
	const slopes = horizonSlopes(grid, data.directionX, data.directionZ);
	const result: HorizonResult = { id: data.id, slopes };
	self.postMessage(result, { transfer: [slopes.buffer] });
};
