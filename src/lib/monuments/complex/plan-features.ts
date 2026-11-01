import { fact } from '../../content/sources.ts';

export interface PlanRectangle {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

export interface PlanPoint {
	x: number;
	z: number;
}

const PLAN_NOTE =
	'Digitised from the Lepsius Situationsplan des Pyramidenfeldes von Giseh (Digital Giza, photo 80), georeferenced on the GIS centres of Khufu and Khafre; residual against Menkaure and the queens ≈ 9–15 m, overall accuracy ≈ ±25 m. Khufu’s mortuary temple (plan reading x ≈ 166) is centred between the pyramid’s east face and G1-a, within that tolerance. Heights are not in the plan.';

export const PLAN_FEATURES = fact(
	{
		khufuTemple: { x: 150, z: -4 } satisfies PlanPoint,
		khufuBoatPits: [
			{ minX: 151, maxX: 159, minZ: 29, maxZ: 81 },
			{ minX: 147, maxX: 155, minZ: -101, maxZ: -50 }
		] satisfies PlanRectangle[],
		khufuCauseway: [
			{ x: 190, z: -10 },
			{ x: 336, z: -62 },
			{ x: 494, z: -102 },
			{ x: 573, z: -138 }
		] satisfies PlanPoint[],
		khafreTemple: { minX: -188, maxX: -69, minZ: 327, maxZ: 382 } satisfies PlanRectangle,
		khafreCauseway: [
			{ x: -63, z: 355 },
			{ x: 250, z: 418 }
		] satisfies PlanPoint[],
		menkaureTemple: { minX: -495, maxX: -445, minZ: 717, maxZ: 765 } satisfies PlanRectangle,
		menkaureCauseway: [
			{ x: -407, z: 740 },
			{ x: -181, z: 739 }
		] satisfies PlanPoint[],
		westCemetery: { minX: -331, maxX: -160, minZ: -77, maxZ: 128 } satisfies PlanRectangle,
		westMastaba: { northSouth: 28, eastWest: 12.5, northSouthGap: 12, eastWestGap: 8 }
	},
	{ unit: 'm', status: 'estimate', sources: ['digitalGiza', 'gizaVectors'], checked: 'primary', note: PLAN_NOTE }
);

export const WRITTEN_FEATURES = fact(
	{ khafreValleyTempleFromSphinx: { x: 15, z: 70 }, khafreCausewayLength: 494.6 },
	{
		unit: 'm',
		status: 'estimate',
		sources: ['wikipediaGiza'],
		checked: 'secondary',
		note: 'Khafre’s valley temple was still buried when the Lepsius plan was drawn (excavated by Mariette in 1853); it is placed south-east of the Sphinx from written descriptions.'
	}
);

export const ESTIMATED_HEIGHTS = fact(
	{ mastaba: 5, templeWall: 4, valleyTempleWall: 7, causeway: 1.4, pavement: 0.6 },
	{
		unit: 'm',
		status: 'hypothesis',
		sources: ['digitalGiza'],
		checked: 'primary',
		note: 'Visual reconstruction: neither the GIS layers nor the plan record heights.'
	}
);
