import { type Box3, type Camera, Group, Mesh, Vector3 } from 'three/webgpu';
import { decodeHeights, type TerrainHeightmapMeta } from '../../data/terrain.ts';
import { createGroundMaterial } from '../../materials/ground.ts';
import type { ShapedTerrain } from './shape.ts';
import { createHorizonGeometry, createTileGeometry, LOD_SEGMENTS, lodForDistance, TILE_SIZE } from './tiles.ts';

export interface Heightmap {
	meta: TerrainHeightmapMeta;
	heights: Float32Array;
}

export async function loadHeightmap(baseUrl: string): Promise<Heightmap> {
	const metaResponse = await fetch(new URL('terrain/giza-height.json', baseUrl));
	if (!metaResponse.ok) throw new Error(`Terrain metadata failed to load (${metaResponse.status})`);
	const meta = (await metaResponse.json()) as TerrainHeightmapMeta;
	const binaryResponse = await fetch(new URL(`terrain/${meta.file}`, baseUrl));
	if (!binaryResponse.ok) throw new Error(`Terrain heights failed to load (${binaryResponse.status})`);
	const samples = new Uint16Array(await binaryResponse.arrayBuffer());
	if (samples.length !== meta.size * meta.size) throw new Error('Terrain heights do not match their metadata');
	return { meta, heights: decodeHeights(samples, meta) };
}

interface Tile {
	mesh: Mesh;
	bounds: Box3;
	level: number;
}

export class Terrain {
	readonly object = new Group();
	private readonly tiles: Tile[] = [];
	private readonly geometries;
	private readonly ground;
	private readonly eye = new Vector3();
	private readonly horizon: Mesh;

	constructor(
		shaped: ShapedTerrain,
		meta: TerrainHeightmapMeta,
		private readonly lodBias = 0
	) {
		this.object.name = 'terrain';
		let minHeight = Number.POSITIVE_INFINITY;
		let maxHeight = Number.NEGATIVE_INFINITY;
		for (const height of shaped.heights) {
			minHeight = Math.min(minHeight, height);
			maxHeight = Math.max(maxHeight, height);
		}
		this.geometries = LOD_SEGMENTS.map((segments) => createTileGeometry(segments, minHeight, maxHeight));
		this.ground = createGroundMaterial(shaped, meta);
		const horizon = new Mesh(
			createHorizonGeometry(meta.center, meta.halfExtent, minHeight, maxHeight),
			this.ground.material
		);
		horizon.name = 'horizon';
		horizon.receiveShadow = true;
		this.horizon = horizon;
		this.object.add(horizon);
		const tilesPerSide = Math.round((meta.halfExtent * 2) / TILE_SIZE);
		const x0 = meta.center.x - meta.halfExtent;
		const z0 = meta.center.z - meta.halfExtent;
		for (let row = 0; row < tilesPerSide; row++) {
			for (let col = 0; col < tilesPerSide; col++) {
				const level = LOD_SEGMENTS.length - 1;
				const mesh = new Mesh(this.geometries[level], this.ground.material);
				mesh.position.set(x0 + col * TILE_SIZE, 0, z0 + row * TILE_SIZE);
				mesh.receiveShadow = true;
				mesh.updateMatrixWorld();
				const bounds = (this.geometries[0].boundingBox as Box3).clone().translate(mesh.position);
				this.tiles.push({ mesh, bounds, level });
				this.object.add(mesh);
			}
		}
	}

	get material() {
		return this.ground.material;
	}

	update(camera: Camera): void {
		camera.getWorldPosition(this.eye);
		for (const tile of this.tiles) {
			const level = lodForDistance(tile.bounds.distanceToPoint(this.eye), this.lodBias);
			if (level === tile.level) continue;
			tile.level = level;
			tile.mesh.geometry = this.geometries[level];
		}
	}

	dispose(): void {
		for (const geometry of this.geometries) geometry.dispose();
		this.horizon.geometry.dispose();
		this.ground.material.dispose();
		this.ground.texture.dispose();
	}
}
