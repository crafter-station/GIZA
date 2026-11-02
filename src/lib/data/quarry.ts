import { fact } from '../content/sources.ts';

export const KHUFU_QUARRY = fact(
	{ maxDepth: 30, extractedVolume: 2_760_000, blockTonnes: [1, 2], monolithTonnes: [50, 100] },
	{
		unit: 'm',
		status: 'estimate',
		sources: ['aeraQuarry', 'lehner1997'],
		checked: 'secondary',
		note: 'Horseshoe-shaped quarry just south of the Great Pyramid and the Khafre causeway, its sides aligned with the pyramid; floor uneven and rising to the north; up to 30 m deep; about 2.76 million m³ removed (Lehner, from a 1977 map with 1 m contours). Channels isolated large blocks, then narrower channels split them into blocks of 1–2 t. Its southern outlet runs under a sand-filled wadi.'
	}
);

export const QUARRY_TRACE = fact(
	{
		west: -95,
		east: 225,
		southFadeStart: 640,
		southFadeEnd: 750,
		northOffsetFromCauseway: 45,
		causeway: { from: { x: -63, z: 355 }, to: { x: 250, z: 418 } },
		edgeSoftness: 10,
		terraceStep: 1.5,
		bedrock: { minX: 232, maxX: 294, minZ: 470, maxZ: 560 },
		monolith: { x: 286, z: 478 }
	},
	{
		unit: 'm',
		status: 'hypothesis',
		sources: ['aeraQuarry', 'digitalGiza'],
		checked: 'secondary',
		note: 'Interpretive trace, not a surveyed plan: the outline follows the published description (south of the Khafre causeway, sides aligned with Khufu, about 10 ha, the area later used by the Central Field cemetery) and the 15–20 m step of the western wall visible in the Copernicus DEM. Terraces quantise the real ground in 1.5 m steps without digging below it; channels, debris and isolated bedrock blocks illustrate the documented techniques at approximate positions.'
	}
);
