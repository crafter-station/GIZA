export interface CollapseStart {
	type: 'start';
	bodies: Float32Array;
	ground: number;
}

export interface CollapseStop {
	type: 'stop';
}

export type CollapseMessage = CollapseStart | CollapseStop;

export const BODY_STRIDE = 10;
export const STATE_STRIDE = 8;
