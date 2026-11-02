import { fact } from '#lib/content/sources.ts';
import { WORKERS_TOWN_LAYOUT } from './workers-town.ts';

const layout = WORKERS_TOWN_LAYOUT.value;
const dx = layout.wallEast.x - layout.wallWest.x;
const dz = layout.wallEast.z - layout.wallWest.z;
const length = Math.hypot(dx, dz);

export const DAILY_LIFE_SITE = {
	x: layout.wallWest.x + (dx * 44 - dz * 160) / length,
	z: layout.wallWest.z + (dz * 44 + dx * 160) / length,
	rotation: Math.atan2(-dz, dx)
} as const;

export const DAILY_LIFE = fact(
	{
		title: 'Daily life: bread and grain',
		body: 'Feeding the pyramid builders required grain processing, bakeries and a steady supply of provisions. These animated workers illustrate grinding grain, preparing bread and carrying pottery beside the reconstructed bakeries. Their clothing, gestures and arrangement are interpretive; they do not portray identified individuals.'
	},
	{ status: 'hypothesis', sources: ['aeraFeedingWorkers', 'aeraLostCity'], checked: 'primary' }
);
