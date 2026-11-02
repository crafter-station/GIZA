import { writable } from 'svelte/store';
import type { BlockTargetId } from '../data/block-targets.ts';
import type { RampId } from '../data/construction.ts';
import type { Backend, Tier } from './quality.ts';

export interface BlockInfo {
	index: number;
	course: number;
	size: readonly [number, number, number];
	kind: 'block' | 'core';
	represents: number;
}

export interface EngineState {
	status: 'loading' | 'ready' | 'error';
	progress: number;
	step: string;
	backend: Backend | null;
	tier: Tier | null;
	blockCount: number;
	coreRatio: number;
	blockMode: 'assembled' | 'deconstructed';
	hovered: BlockInfo | null;
	selected: BlockInfo | null;
	inspecting: BlockInfo | null;
	xray: number | null;
	build: number | null;
	ramp: RampId | null;
	origins: boolean;
	sound: boolean;
	target: BlockTargetId;
	switchingTarget: boolean;
	hotspot: string | null;
	forceField: boolean;
	collapsed: boolean;
	error: string | null;
}

export const INITIAL_ENGINE_STATE: EngineState = {
	status: 'loading',
	progress: 0,
	step: 'Starting',
	backend: null,
	tier: null,
	blockCount: 0,
	coreRatio: 0,
	blockMode: 'assembled',
	hovered: null,
	selected: null,
	inspecting: null,
	xray: null,
	build: null,
	ramp: 'spiral',
	origins: false,
	sound: false,
	target: 'khufu',
	switchingTarget: false,
	hotspot: null,
	forceField: false,
	collapsed: false,
	error: null
};

export const engineState = writable<EngineState>(INITIAL_ENGINE_STATE);

export interface TourState {
	t: number;
	chapter: number;
	mode: 'tour' | 'free';
	drone: boolean;
}

export const tourState = writable<TourState>({ t: 0, chapter: 0, mode: 'tour', drone: false });

export interface HotspotMarker {
	id: string;
	number: number;
	x: number;
	y: number;
	occluded: boolean;
}

export const hotspotMarkers = writable<HotspotMarker[]>([]);
