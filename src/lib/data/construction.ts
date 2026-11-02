import { fact } from '../content/sources.ts';
import { MASONRY_PALETTE } from '../materials/masonry-palette.ts';
import { DERIVED, KHUFU } from './pyramids.ts';

export type RampId = 'straight' | 'zigzag' | 'spiral' | 'internal';

export interface RampHypothesis {
	id: RampId;
	name: string;
	summary: string;
}

const ramp = (id: RampId, name: string, summary: string): RampHypothesis => ({ id, name, summary });

export const RAMP_HYPOTHESES = [
	fact(
		ramp(
			'straight',
			'Straight ramp',
			'One long ramp rising from the quarry to the south. It would have to grow longer and wider with every course.'
		),
		{ status: 'hypothesis', sources: ['lehner1997'], checked: 'secondary' }
	),
	fact(
		ramp(
			'zigzag',
			'Zigzag ramp',
			'Switchbacks climbing one face, as on the remains of ramps found at other pyramid sites.'
		),
		{ status: 'hypothesis', sources: ['lehner1997'], checked: 'secondary' }
	),
	fact(
		ramp(
			'spiral',
			'Spiral ramp',
			'A ramp wrapped around the four faces and resting on the unfinished casing, climbing as the pyramid rose.'
		),
		{ status: 'hypothesis', sources: ['lehner1997'], checked: 'secondary' }
	),
	fact(
		ramp(
			'internal',
			'Internal ramp',
			'A spiral corridor built inside the pyramid, a few metres behind the faces, proposed by Jean-Pierre Houdin.'
		),
		{ status: 'hypothesis', sources: ['brierHoudin2008'], checked: 'secondary' }
	)
] as const;

export const RAMP_DRAWING = fact(
	{ grade: 0.1, width: 8, internalInset: 12 },
	{
		unit: 'm',
		status: 'hypothesis',
		sources: ['lehner1997', 'brierHoudin2008'],
		checked: 'secondary',
		note: 'Ramps are drawn schematically: no ramp survives at Khufu, so the slope (1:10), width and inset are visual choices, not measurements.'
	}
);

export const BUILD_TIMELINE = fact(
	{ years: DERIVED.blocksPerDay.value.years, blocks: KHUFU.blockCount.value, workforce: DERIVED.workforce.value },
	{
		status: 'estimate',
		sources: ['tallet2017', 'romer2007', 'novaBuilders', 'aeraLostCity'],
		checked: 'computed',
		note: 'Courses appear in order, timed by the share of the total volume laid; this assumes a constant rate of stone over about 26 years, which no source records.'
	}
);

export type StoneOriginId = 'local' | 'tura' | 'granite';

export interface StoneOrigin {
	id: StoneOriginId;
	name: string;
	use: string;
	color: number;
}

export const STONE_ORIGINS = [
	fact(
		{
			id: 'local' as const,
			name: 'Local limestone',
			use: 'The core and most of the passages, cut on the plateau just south of the pyramid.',
			color: MASONRY_PALETTE.coreLight
		},
		{ status: 'established', sources: ['lehner1997'], checked: 'secondary' }
	),
	fact(
		{
			id: 'tura' as const,
			name: 'Tura limestone',
			use: 'The white outer casing, shipped across the Nile; the Diary of Merer records the shipments. It was stripped in the Middle Ages and only remnants of course 1 remain.',
			color: MASONRY_PALETTE.tura
		},
		{ status: 'established', sources: ['tallet2017', 'lehner1997'], checked: 'secondary' }
	),
	fact(
		{
			id: 'granite' as const,
			name: 'Aswan granite',
			use: 'The King’s Chamber and its roof beams, brought down the Nile from more than 800 km to the south.',
			color: MASONRY_PALETTE.granite
		},
		{ status: 'established', sources: ['lehner1997', 'wikipediaGiza'], checked: 'secondary' }
	)
] as const satisfies readonly { value: StoneOrigin }[];

export function cumulativeCourseVolume(courses: readonly number[], baseSide: number, originalHeight: number): number[] {
	const sideAt = (y: number) => baseSide * (1 - y / originalHeight);
	const totals: number[] = [];
	let bottom = 0;
	let total = 0;
	for (const thickness of courses) {
		const top = bottom + thickness;
		const a = sideAt(bottom);
		const b = sideAt(top);
		total += (thickness * (a * a + a * b + b * b)) / 3;
		totals.push(total);
		bottom = top;
	}
	return totals;
}

export function courseAtProgress(cumulative: readonly number[], progress: number): number {
	const total = cumulative[cumulative.length - 1] ?? 0;
	const target = Math.min(Math.max(progress, 0), 1) * total;
	let low = 0;
	let high = cumulative.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (cumulative[mid] < target) low = mid + 1;
		else high = mid;
	}
	if (low >= cumulative.length) return cumulative.length;
	const before = low === 0 ? 0 : cumulative[low - 1];
	return low + (target - before) / (cumulative[low] - before);
}
