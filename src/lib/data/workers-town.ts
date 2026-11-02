import { fact } from '../content/sources.ts';

export const WALL_OF_THE_CROW = fact(
	{ length: 200, height: 10, baseThickness: 10, gate: { width: 2.6, height: 7 }, southOfSphinx: 400 },
	{
		unit: 'm',
		status: 'established',
		sources: ['aeraWallOfTheCrow'],
		checked: 'secondary',
		note: 'A limestone wall about 200 m long, 10 m high and 10 m thick at the base, a few hundred metres south of the Sphinx; its great gateway, 2.5–2.6 m wide and about 7 m high, runs like a short tunnel through it. It still stands.'
	}
);

export const WORKERS_TOWN = fact(
	{ area: 70_000, gallerySetSize: [9, 12], silos: 10 },
	{
		unit: 'm²',
		status: 'established',
		sources: ['aeraLostCity', 'aeraWallOfTheCrow'],
		checked: 'secondary',
		note: 'Heit el-Ghurab, the town of the pyramid builders, covers more than 7 ha south-east of the Wall of the Crow: an Enclosure Wall on the west, Gallery Sets of 9–12 long buildings, a Main Street leading to the great gateway, a Royal Administrative Building with ten grain silos, bakeries, and the Western and Eastern towns. It was demolished after Menkaure’s pyramid was completed.'
	}
);

export const WORKERS_TOWN_LAYOUT = fact(
	{
		wallWest: { x: 230, z: 792 },
		wallEast: { x: 420, z: 722 },
		gateAlong: 0.42,
		gallery: { length: 35, width: 4.6, pitch: 6.2, height: 4.2 },
		silo: { diameter: 5, height: 6 },
		houses: { size: [7, 14], height: 3.2 }
	},
	{
		unit: 'm',
		status: 'hypothesis',
		sources: ['aeraLostCity', 'aeraWallOfTheCrow'],
		checked: 'secondary',
		note: 'Schematic layout: the wall is placed about 400 m south of the Sphinx at the mouth of the wadi, bordering the town on the north-west; the sizes of each gallery, silo and house, the roofs and the exact positions are visual choices, because the sources consulted give the components but not their plan.'
	}
);
