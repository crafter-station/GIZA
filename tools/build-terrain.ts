import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fromFile } from 'geotiff';
import { GIZA_ORIGIN, MONUMENT_COORDINATES, toGeo, toLocal } from '../src/lib/data/geo.ts';
import type { MonumentCheck, TerrainHeightmapMeta } from '../src/lib/data/terrain.ts';

const HALF_EXTENT = 4096;
const CENTER = { x: 0, z: 1920 };
const SIZE = 257;
const CROP_MARGIN_SAMPLES = 3;
const SEARCH_RADIUS = 120;
const RING = [250, 400];

const ROOT = resolve(import.meta.dirname, '..');
const sourcePath = process.argv[2];
if (!sourcePath) {
	console.error('Usage: node tools/build-terrain.ts <Copernicus_DSM_10_N29_00_E031_00_DEM.tif>');
	process.exit(1);
}

const tiff = await fromFile(sourcePath);
const image = await tiff.getImage();
const width = image.getWidth();
const height = image.getHeight();
const [originLon, originLat] = image.getOrigin();
const [resX, resY] = image.getResolution();
const degX = resX;
const degY = -resY;
const centerOffset = image.getGeoKeys()?.GTRasterTypeGeoKey === 2 ? 0 : 0.5;
const west = originLon + centerOffset * degX;
const north = originLat - centerOffset * degY;

const northWest = toGeo({ x: CENTER.x - HALF_EXTENT, z: CENTER.z - HALF_EXTENT });
const southEast = toGeo({ x: CENTER.x + HALF_EXTENT, z: CENTER.z + HALF_EXTENT });
const col0 = Math.floor((northWest.lon - west) / degX) - CROP_MARGIN_SAMPLES;
const col1 = Math.ceil((southEast.lon - west) / degX) + CROP_MARGIN_SAMPLES + 1;
const row0 = Math.floor((north - northWest.lat) / degY) - CROP_MARGIN_SAMPLES;
const row1 = Math.ceil((north - southEast.lat) / degY) + CROP_MARGIN_SAMPLES + 1;
if (col0 < 0 || row0 < 0 || col1 > width || row1 > height) {
	throw new Error(`Window [${col0}, ${row0}, ${col1}, ${row1}] falls outside this ${width}×${height} tile.`);
}

const [raster] = (await image.readRasters({ window: [col0, row0, col1, row1] })) as unknown as [Float32Array];
const cropW = col1 - col0;
const cropH = row1 - row0;
const cropWest = west + col0 * degX;
const cropNorth = north - row0 * degY;
for (const v of raster) if (!Number.isFinite(v) || v < -1000) throw new Error('No-data samples in the crop window.');

function sampleGeo(lat: number, lon: number): number {
	const fx = Math.min(Math.max((lon - cropWest) / degX, 0), cropW - 1);
	const fy = Math.min(Math.max((cropNorth - lat) / degY, 0), cropH - 1);
	const x0 = Math.min(Math.floor(fx), cropW - 2);
	const y0 = Math.min(Math.floor(fy), cropH - 2);
	const tx = fx - x0;
	const ty = fy - y0;
	const i = y0 * cropW + x0;
	const top = raster[i] * (1 - tx) + raster[i + 1] * tx;
	const bottom = raster[i + cropW] * (1 - tx) + raster[i + cropW + 1] * tx;
	return top * (1 - ty) + bottom * ty;
}

const spacing = (2 * HALF_EXTENT) / (SIZE - 1);
const heights = new Float32Array(SIZE * SIZE);
let minHeight = Number.POSITIVE_INFINITY;
let maxHeight = Number.NEGATIVE_INFINITY;
for (let row = 0; row < SIZE; row++) {
	for (let col = 0; col < SIZE; col++) {
		const geo = toGeo({ x: CENTER.x - HALF_EXTENT + col * spacing, z: CENTER.z - HALF_EXTENT + row * spacing });
		const h = sampleGeo(geo.lat, geo.lon);
		heights[row * SIZE + col] = h;
		minHeight = Math.min(minHeight, h);
		maxHeight = Math.max(maxHeight, h);
	}
}
minHeight = Math.floor(minHeight);
maxHeight = Math.ceil(maxHeight);
const samples = new Uint16Array(SIZE * SIZE);
for (let i = 0; i < heights.length; i++) {
	samples[i] = Math.round(((heights[i] - minHeight) / (maxHeight - minHeight)) * 65535);
}

function checkMonument(expectedGeo: { lat: number; lon: number }): MonumentCheck {
	const expected = toLocal(expectedGeo);
	let best = { x: 0, z: 0, height: Number.NEGATIVE_INFINITY };
	for (let row = 0; row < cropH; row++) {
		for (let col = 0; col < cropW; col++) {
			const p = toLocal({ lat: cropNorth - row * degY, lon: cropWest + col * degX });
			if (Math.hypot(p.x - expected.x, p.z - expected.z) > SEARCH_RADIUS) continue;
			const h = raster[row * cropW + col];
			if (h > best.height) best = { x: p.x, z: p.z, height: h };
		}
	}
	const ring: number[] = [];
	for (let a = 0; a < 64; a++) {
		for (const r of RING) {
			const angle = (a / 64) * Math.PI * 2;
			const geo = toGeo({ x: best.x + Math.cos(angle) * r, z: best.z + Math.sin(angle) * r });
			ring.push(sampleGeo(geo.lat, geo.lon));
		}
	}
	ring.sort((a, b) => a - b);
	const round = (v: number) => Math.round(v * 10) / 10;
	return {
		expected: { x: round(expected.x), z: round(expected.z) },
		peak: { x: round(best.x), z: round(best.z), height: round(best.height) },
		offset: round(Math.hypot(best.x - expected.x, best.z - expected.z)),
		prominence: round(best.height - ring[ring.length >> 1])
	};
}

const verification: Record<string, MonumentCheck> = {};
for (const [id, coords] of Object.entries(MONUMENT_COORDINATES)) verification[id] = checkMonument(coords);

const attribution =
	'Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.';
const meta: TerrainHeightmapMeta = {
	version: 1,
	file: 'giza-height.bin',
	size: SIZE,
	center: CENTER,
	halfExtent: HALF_EXTENT,
	spacing,
	minHeight,
	maxHeight,
	verticalDatum: 'EGM2008',
	origin: GIZA_ORIGIN,
	surfaceModel: true,
	source: {
		product: 'Copernicus DEM GLO-30 (DGED 2021_1), digital surface model',
		tile: 'Copernicus_DSM_10_N29_00_E031_00',
		attribution,
		license:
			'Copernicus DEM licence (free use with attribution): https://spacedata.copernicus.eu/web/cscda/data-offer/terms-and-conditions'
	},
	verification
};

function png8(data: Uint8Array, w: number, h: number): Buffer {
	const crcTable = new Int32Array(256).map((_, n) => {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		return c;
	});
	const crc = (buf: Buffer) => {
		let c = -1;
		for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
		return (c ^ -1) >>> 0;
	};
	const chunk = (type: string, body: Buffer) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(body.length);
		const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
		const sum = Buffer.alloc(4);
		sum.writeUInt32BE(crc(typed));
		return Buffer.concat([len, typed, sum]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(w, 0);
	header.writeUInt32BE(h, 4);
	header[8] = 8;
	header[9] = 0;
	const rows = Buffer.alloc((w + 1) * h);
	for (let y = 0; y < h; y++) rows.set(data.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0))
	]);
}
const shade = new Uint8Array(SIZE * SIZE);
const light = [-Math.SQRT1_2 * 0.7, 0.7, -Math.SQRT1_2 * 0.7];
for (let row = 0; row < SIZE; row++) {
	for (let col = 0; col < SIZE; col++) {
		const h = (r: number, c: number) =>
			heights[Math.min(Math.max(r, 0), SIZE - 1) * SIZE + Math.min(Math.max(c, 0), SIZE - 1)];
		const dx = (h(row, col + 1) - h(row, col - 1)) / (2 * spacing);
		const dz = (h(row + 1, col) - h(row - 1, col)) / (2 * spacing);
		const len = Math.hypot(dx, 1, dz);
		const lambert = (-dx * light[0] + light[1] - dz * light[2]) / len;
		const tint = (heights[row * SIZE + col] - minHeight) / (maxHeight - minHeight);
		shade[row * SIZE + col] = Math.round(Math.min(Math.max(lambert * 0.75 + tint * 0.25, 0), 1) * 255);
	}
}

const out = async (path: string, data: string | Uint8Array) => {
	const full = resolve(ROOT, path);
	await mkdir(dirname(full), { recursive: true });
	await writeFile(full, data);
	console.log(`wrote ${path}`);
};
await out('assets-src/dem/giza-cop30-crop.f32', new Uint8Array(raster.buffer, raster.byteOffset, raster.byteLength));
await out(
	'assets-src/dem/giza-cop30-crop.json',
	`${JSON.stringify({ width: cropW, height: cropH, west: cropWest, north: cropNorth, degX, degY, layout: 'float32 little-endian, row-major, row 0 = north; west/north are the first sample center', attribution }, null, '\t')}\n`
);
await out('assets-src/dem/giza-height-preview.png', png8(shade, SIZE, SIZE));
await out('static/terrain/giza-height.bin', new Uint8Array(samples.buffer));
await out('static/terrain/giza-height.json', `${JSON.stringify(meta, null, '\t')}\n`);
console.table(
	Object.fromEntries(
		Object.entries(verification).map(([k, v]) => [
			k,
			{ offset_m: v.offset, peak_m: v.peak.height, prominence_m: v.prominence }
		])
	)
);
console.log(`heights ${minHeight}–${maxHeight} m, spacing ${spacing} m, crop ${cropW}×${cropH} px`);
