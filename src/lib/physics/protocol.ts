export interface CollapseStart {
	type: 'start';
	bodies: Float32Array;
	ground: number;
}

export interface CollapseStop {
	type: 'stop';
}

export type CollapseMessage = CollapseStart | CollapseStop;

export const PHYSICS_STEP = 1 / 60;
export const BODY_STRIDE = 10;
export const STATE_STRIDE = 8;
