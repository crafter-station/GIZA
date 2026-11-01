import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NodeIO, Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, normals, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

interface ModelJob {
	source: string;
	output: string;
	targetTriangles: number;
	maxError: number;
	stripTextures: boolean;
	recomputeNormals: boolean;
}

const MODELS: Record<string, ModelJob> = {
	'great-sphinx': {
		source: 'assets-src/models/great-sphinx/the-great-sphinx-of-giza.glb',
		output: 'static/models/great-sphinx.glb',
		targetTriangles: 120_000,
		maxError: 0.02,
		stripTextures: true,
		recomputeNormals: false
	}
};

const ROOT = resolve(import.meta.dirname, '..');
const ids = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(MODELS);

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
	'draco3d.decoder': await draco3d.createDecoderModule(),
	'meshopt.encoder': MeshoptEncoder
});

function countTriangles(primitives: Primitive[]): number {
	return primitives.reduce((sum, primitive) => {
		const indices = primitive.getIndices();
		const vertices = primitive.getAttribute('POSITION');
		return sum + (indices ? indices.getCount() : (vertices?.getCount() ?? 0)) / 3;
	}, 0);
}

for (const id of ids) {
	const model = MODELS[id];
	if (!model) throw new Error(`Unknown model "${id}". Known: ${Object.keys(MODELS).join(', ')}`);
	const document = await io.read(resolve(ROOT, model.source));
	const root = document.getRoot();

	for (const mesh of root.listMeshes()) {
		for (const primitive of mesh.listPrimitives()) {
			if (primitive.getMode() !== Primitive.Mode.TRIANGLES) primitive.dispose();
		}
	}
	for (const extension of root.listExtensionsUsed()) {
		if (['KHR_draco_mesh_compression', 'KHR_materials_pbrSpecularGlossiness'].includes(extension.extensionName)) {
			extension.dispose();
		}
	}

	if (model.stripTextures) {
		const shared = document.createMaterial('stone');
		for (const primitive of root.listMeshes().flatMap((mesh) => mesh.listPrimitives())) primitive.setMaterial(shared);
		for (const primitive of root.listMeshes().flatMap((mesh) => mesh.listPrimitives())) {
			for (const semantic of primitive.listSemantics()) {
				if (semantic.startsWith('TEXCOORD') || (model.recomputeNormals && semantic === 'NORMAL')) {
					primitive.setAttribute(semantic, null);
				}
			}
		}
	}

	const primitives = () => root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
	const before = countTriangles(primitives());
	await document.transform(prune(), dedup(), flatten(), join(), weld());
	const ratio = Math.min(1, model.targetTriangles / countTriangles(primitives()));
	await document.transform(
		simplify({ simplifier: MeshoptSimplifier, ratio, error: model.maxError, lockBorder: false }),
		prune(),
		...(model.recomputeNormals ? [normals({ overwrite: true })] : []),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' })
	);
	document.createExtension(EXTMeshoptCompression).setRequired(true);

	const output = resolve(ROOT, model.output);
	await mkdir(dirname(output), { recursive: true });
	await io.write(output, document);
	console.log(
		`${id}: ${before} → ${countTriangles(primitives())} triangles, ${root.listMeshes().length} meshes → ${model.output}`
	);
}
