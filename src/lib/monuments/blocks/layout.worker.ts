import { type BlockLayoutRequest, generateBlockLayout } from './layout.ts';

self.onmessage = (event: MessageEvent<BlockLayoutRequest>) => {
	const layout = generateBlockLayout(event.data);
	self.postMessage(layout, { transfer: [layout.home.buffer, layout.size.buffer] });
};
