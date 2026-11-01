import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type LocalPoint, toLocal } from '../src/lib/data/geo.ts';

const SERVICE = 'https://services1.arcgis.com/qN3V93cYGMKQCOxL/ArcGIS/rest/services/GIZA_Vectors_for_Web/FeatureServer';
const OUTPUT = resolve(import.meta.dirname, '../src/lib/data/giza-gis.ts');

const PYRAMID_ANCHORS = {
	khufu: { x: 0, z: 0 },
	khafre: { x: -322, z: 339 },
	menkaure: { x: -563, z: 739 },
	g1a: { x: 203, z: 33 },
	g1b: { x: 202, z: 90 },
	g1c: { x: 200, z: 143 },
	g3a: { x: -559, z: 840 },
	g3b: { x: -603, z: 840 },
	g3c: { x: -647, z: 839 }
} as const;

interface Feature {
	properties: Record<string, unknown>;
	geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

async function layer(id: number): Promise<Feature[]> {
	const url = `${SERVICE}/${id}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Layer ${id} failed: ${response.status}`);
	return ((await response.json()) as { features: Feature[] }).features;
}

function outerRings(feature: Feature): LocalPoint[][] {
	const polygons =
		feature.geometry.type === 'Polygon'
			? [feature.geometry.coordinates as number[][][]]
			: (feature.geometry.coordinates as number[][][][]);
	return polygons.map((polygon) => polygon[0].map(([lon, lat]) => toLocal({ lat, lon })));
}

function bounds(points: LocalPoint[]) {
	const xs = points.map((p) => p.x);
	const zs = points.map((p) => p.z);
	return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function orientedRectangle(points: LocalPoint[]) {
	const ring = points.slice(0, -1);
	let best = { area: Number.POSITIVE_INFINITY, angle: 0, width: 0, depth: 0, x: 0, z: 0 };
	for (let i = 0; i < ring.length; i++) {
		const a = ring[i];
		const b = ring[(i + 1) % ring.length];
		const angle = Math.atan2(b.x - a.x, b.z - a.z);
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const us = ring.map((p) => p.x * cos - p.z * sin);
		const vs = ring.map((p) => p.x * sin + p.z * cos);
		const width = Math.max(...us) - Math.min(...us);
		const depth = Math.max(...vs) - Math.min(...vs);
		if (width * depth < best.area) {
			const u = (Math.max(...us) + Math.min(...us)) / 2;
			const v = (Math.max(...vs) + Math.min(...vs)) / 2;
			best = { area: width * depth, angle, width, depth, x: u * cos + v * sin, z: -u * sin + v * cos };
		}
	}
	return best;
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

const pyramids = await layer(0);
const pyramidCenters: Record<string, { x: number; z: number; width: number; depth: number }> = {};
for (const [id, anchor] of Object.entries(PYRAMID_ANCHORS)) {
	let nearest: { distance: number; box: ReturnType<typeof bounds> } | null = null;
	for (const feature of pyramids) {
		const box = bounds(outerRings(feature).flat());
		const distance = Math.hypot((box.minX + box.maxX) / 2 - anchor.x, (box.minZ + box.maxZ) / 2 - anchor.z);
		if (!nearest || distance < nearest.distance) nearest = { distance, box };
	}
	if (!nearest || nearest.distance > 30) throw new Error(`No GIS footprint near ${id}`);
	const { box } = nearest;
	pyramidCenters[id] = {
		x: round((box.minX + box.maxX) / 2),
		z: round((box.minZ + box.maxZ) / 2),
		width: round(box.maxX - box.minX),
		depth: round(box.maxZ - box.minZ)
	};
}

const mastabas = (await layer(3)).flatMap((feature) =>
	outerRings(feature).map((ring) => {
		const rectangle = orientedRectangle(ring);
		return {
			name: (feature.properties.NAME as string | null) ?? null,
			period: (feature.properties.DATE_ as string | null) ?? null,
			x: round(rectangle.x),
			z: round(rectangle.z),
			width: round(rectangle.width),
			depth: round(rectangle.depth),
			rotation: round(rectangle.angle, 4)
		};
	})
);

const source = `export interface GisFootprint {
	x: number;
	z: number;
	width: number;
	depth: number;
}

export interface GisMastaba extends GisFootprint {
	name: string | null;
	period: string | null;
	rotation: number;
}

export const GIS_PYRAMID_CENTERS: Record<string, GisFootprint> = ${JSON.stringify(pyramidCenters, null, '\t')};

export const GIS_MASTABAS: readonly GisMastaba[] = ${JSON.stringify(mastabas, null, '\t')};
`;
await writeFile(OUTPUT, source);
console.log(`wrote ${Object.keys(pyramidCenters).length} pyramid footprints and ${mastabas.length} mastabas`);
