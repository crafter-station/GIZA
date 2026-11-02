import { PLAN_FEATURES } from '#lib/monuments/complex/plan-features.ts';
import { type Fact, fact } from '../content/sources.ts';
import type { BlockTargetId } from './block-targets.ts';
import { GIS_MASTABAS } from './giza-gis.ts';
import { SPHINX_PLACEMENT } from './layout.ts';
import { KHAFRE, KHUFU_OPENINGS, MENKAURE, MENKAURE_GRANITE, SPHINX } from './pyramids.ts';
import { KHUFU_QUARRY, QUARRY_TRACE } from './quarry.ts';
import { WALL_OF_THE_CROW, WORKERS_TOWN, WORKERS_TOWN_LAYOUT } from './workers-town.ts';

export type HotspotAnchor =
	| { kind: 'face'; pyramid: BlockTargetId; side: 'north' | 'east'; height: number; along: number }
	| { kind: 'ground'; x: number; z: number; lift: number };

export interface HotspotView {
	distance: number;
	bearing: number;
	elevation: number;
}

export interface HotspotText {
	title: string;
	body: string;
}

export interface Hotspot {
	id: string;
	anchor: HotspotAnchor;
	view: HotspotView;
	text: Fact<HotspotText>;
}

const entrance = KHUFU_OPENINGS.entrance.value;
const tunnel = KHUFU_OPENINGS.robbersTunnel.value;
const quarry = KHUFU_QUARRY.value;
const townLayout = WORKERS_TOWN_LAYOUT.value;
const gate = {
	x: townLayout.wallWest.x + (townLayout.wallEast.x - townLayout.wallWest.x) * townLayout.gateAlong,
	z: townLayout.wallWest.z + (townLayout.wallEast.z - townLayout.wallWest.z) * townLayout.gateAlong
};
const eastMastabas = GIS_MASTABAS.filter((mastaba) => mastaba.x > 150);
const mastabaCentre = {
	x: eastMastabas.reduce((sum, mastaba) => sum + mastaba.x, 0) / eastMastabas.length,
	z: eastMastabas.reduce((sum, mastaba) => sum + mastaba.z, 0) / eastMastabas.length
};

export const HOTSPOTS: readonly Hotspot[] = [
	{
		id: 'sphinx',
		anchor: {
			kind: 'ground',
			x: SPHINX_PLACEMENT.x + SPHINX_PLACEMENT.renderedLength * 0.36,
			z: SPHINX_PLACEMENT.z,
			lift: SPHINX_PLACEMENT.renderedHeight * 0.85
		},
		view: { distance: 95, bearing: 105, elevation: 12 },
		text: fact(
			{
				title: 'The Great Sphinx',
				body: `Carved from bedrock left standing in the quarry, about ${SPHINX.size.value.length} m long and ${SPHINX.size.value.height} m high, facing ${SPHINX.facing.value}.`
			},
			{ status: 'established', sources: ['wikipediaGiza', 'lehner1997'], checked: 'secondary' }
		)
	},
	{
		id: 'khufu-entrance',
		anchor: { kind: 'face', pyramid: 'khufu', side: 'north', height: entrance.height, along: entrance.eastOfCenter },
		view: { distance: 70, bearing: 0, elevation: 16 },
		text: fact(
			{
				title: 'The original entrance',
				body: `About ${entrance.height} m up the north face, in course ${entrance.course}, ${entrance.eastOfCenter} m (15 royal cubits) east of the centre line. It leads to the descending passage.`
			},
			{ status: 'established', sources: KHUFU_OPENINGS.entrance.sources, checked: 'secondary' }
		)
	},
	{
		id: 'robbers-tunnel',
		anchor: { kind: 'face', pyramid: 'khufu', side: 'north', height: tunnel.height, along: 0 },
		view: { distance: 55, bearing: 345, elevation: 8 },
		text: fact(
			{ title: 'The robbers’ tunnel', body: KHUFU_OPENINGS.robbersTunnel.note ?? '' },
			{ status: 'established', sources: KHUFU_OPENINGS.robbersTunnel.sources, checked: 'secondary' }
		)
	},
	{
		id: 'khufu-casing',
		anchor: { kind: 'face', pyramid: 'khufu', side: 'north', height: 0.8, along: -40 },
		view: { distance: 45, bearing: 20, elevation: 10 },
		text: fact(
			{ title: 'Remains of the casing', body: KHUFU_OPENINGS.casingRemnants.value },
			{ status: 'established', sources: KHUFU_OPENINGS.casingRemnants.sources, checked: 'secondary' }
		)
	},
	{
		id: 'boat-pits',
		anchor: { kind: 'ground', x: 155, z: 55, lift: 1 },
		view: { distance: 110, bearing: 90, elevation: 35 },
		text: fact(
			{
				title: 'Boat pits',
				body: 'Boat-shaped pits cut into the bedrock east of the pyramid, beside the mortuary temple, placed here from Lepsius’s plan.'
			},
			{ status: 'established', sources: ['digitalGiza', 'lehner1997'], checked: 'secondary' }
		)
	},
	{
		id: 'khufu-causeway',
		anchor: { kind: 'ground', x: 336, z: -62, lift: 3 },
		view: { distance: 160, bearing: 30, elevation: 25 },
		text: fact(
			{
				title: 'Khufu’s causeway',
				body: 'A walled ramp ran from the mortuary temple down the escarpment towards the valley; its course here is traced from Lepsius’s plan.'
			},
			{ status: 'established', sources: ['digitalGiza', 'lehner1997'], checked: 'secondary' }
		)
	},
	{
		id: 'khufu-temple',
		anchor: { kind: 'ground', ...PLAN_FEATURES.value.khufuTemple, lift: 1 },
		view: { distance: 65, bearing: 135, elevation: 28 },
		text: fact(
			{
				title: 'Basalt court of Khufu’s temple',
				body: 'The mortuary temple’s dark basalt pavement was fitted from irregular slabs over a limestone bedding. This scene interprets the surviving court: individual joints, broken walls and fallen fragments are illustrative, not a stone-by-stone survey.'
			},
			{ status: 'hypothesis', sources: ['arceKhufuTemple', 'digitalGiza'], checked: 'primary' }
		)
	},
	{
		id: 'east-cemetery',
		anchor: { kind: 'ground', x: mastabaCentre.x, z: mastabaCentre.z, lift: 5 },
		view: { distance: 260, bearing: 120, elevation: 35 },
		text: fact(
			{
				title: 'The Eastern Cemetery',
				body: `Rows of mastaba tombs for Khufu’s family and officials; ${eastMastabas.length} footprints come from the Giza GIS.`
			},
			{ status: 'established', sources: ['gizaVectors', 'digitalGiza'], checked: 'secondary' }
		)
	},
	{
		id: 'khafre-casing',
		anchor: { kind: 'face', pyramid: 'khafre', side: 'east', height: 122, along: 0 },
		view: { distance: 230, bearing: 80, elevation: 20 },
		text: fact(
			{ title: 'Khafre’s surviving casing', body: KHAFRE.casing.value },
			{ status: 'established', sources: KHAFRE.casing.sources, checked: 'secondary' }
		)
	},
	{
		id: 'quarry-monolith',
		anchor: { kind: 'ground', x: QUARRY_TRACE.value.monolith.x, z: QUARRY_TRACE.value.monolith.z, lift: 2 },
		view: { distance: 45, bearing: 200, elevation: 22 },
		text: fact(
			{
				title: 'An unfinished block',
				body: `A block of ${quarry.monolithTonnes[0]}–${quarry.monolithTonnes[1]} t still roughed out and attached to the bedrock near the Sphinx, in the quarry that supplied Khufu’s core. Its position here is approximate.`
			},
			{ status: 'established', sources: ['aeraQuarry'], checked: 'secondary' }
		)
	},
	{
		id: 'wall-of-the-crow',
		anchor: { kind: 'ground', x: gate.x, z: gate.z, lift: 8 },
		view: { distance: 120, bearing: 150, elevation: 16 },
		text: fact(
			{ title: 'The Wall of the Crow', body: WALL_OF_THE_CROW.note ?? '' },
			{ status: 'established', sources: WALL_OF_THE_CROW.sources, checked: 'secondary' }
		)
	},
	{
		id: 'workers-town',
		anchor: { kind: 'ground', x: gate.x + 60, z: gate.z + 90, lift: 4 },
		view: { distance: 280, bearing: 175, elevation: 32 },
		text: fact(
			{
				title: 'The town of the pyramid builders',
				body: `${WORKERS_TOWN.note ?? ''} Its buried remains lie here. The reconstruction is shown faintly while exploring and in full at this point and in the “Then and now” chapter; its layout is schematic.`
			},
			{ status: 'established', sources: WORKERS_TOWN.sources, checked: 'secondary' }
		)
	},
	{
		id: 'menkaure-granite',
		anchor: { kind: 'face', pyramid: 'menkaure', side: 'north', height: 4, along: -30 },
		view: { distance: 70, bearing: 340, elevation: 8 },
		text: fact(
			{ title: 'Aswan granite casing', body: MENKAURE_GRANITE.note ?? '' },
			{ status: 'estimate', sources: MENKAURE_GRANITE.sources, checked: 'secondary' }
		)
	},
	{
		id: 'menkaure-breach',
		anchor: { kind: 'face', pyramid: 'menkaure', side: 'north', height: 14, along: 0 },
		view: { distance: 95, bearing: 0, elevation: 12 },
		text: fact(
			{
				title: `The breach of ${MENKAURE.demolitionAttempt.value}`,
				body: MENKAURE.demolitionAttempt.note ?? ''
			},
			{ status: 'established', sources: MENKAURE.demolitionAttempt.sources, checked: 'secondary' }
		)
	}
];

export function hotspotById(id: string): Hotspot | undefined {
	return HOTSPOTS.find((hotspot) => hotspot.id === id);
}
