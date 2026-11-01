import { writable } from 'svelte/store';
import type { Backend, Tier } from './quality.ts';

export interface BlockInfo {
	index: number;
	course: number;
	size: readonly [number, number, number];
}

export interface EngineState {
	status: 'loading' | 'ready' | 'error';
	progress: number;
	step: string;
	backend: Backend | null;
	tier: Tier | null;
	blockCount: number;
	blockMode: 'assembled' | 'deconstructed';
	hovered: BlockInfo | null;
	selected: BlockInfo | null;
	error: string | null;
}

export const INITIAL_ENGINE_STATE: EngineState = {
	status: 'loading',
	progress: 0,
	step: 'Starting',
	backend: null,
	tier: null,
	blockCount: 0,
	blockMode: 'assembled',
	hovered: null,
	selected: null,
	error: null
};

export const engineState = writable<EngineState>(INITIAL_ENGINE_STATE);

export interface TourState {
	t: number;
	chapter: number;
	mode: 'tour' | 'free';
}

export const tourState = writable<TourState>({ t: 0, chapter: 0, mode: 'tour' });
