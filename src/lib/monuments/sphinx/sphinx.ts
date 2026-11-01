import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Group, type Material, type Mesh, type Object3D, Vector3 } from 'three/webgpu';

export interface SphinxPlacement {
	x: number;
	z: number;
	ground: number;
	height: number;
}

interface ModelSurvey {
	floor: number;
	top: number;
	headZ: number;
	centerZ: number;
}

const FLOOR_BINS = 24;

function surveyModel(model: Object3D): ModelSurvey {
	const vertex = new Vector3();
	const heights: number[] = [];
	let top = Number.NEGATIVE_INFINITY;
	let bottom = Number.POSITIVE_INFINITY;
	let headZ = 0;
	model.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh) return;
		const position = mesh.geometry.getAttribute('position');
		for (let i = 0; i < position.count; i++) {
			vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
			heights.push(vertex.y);
			bottom = Math.min(bottom, vertex.y);
			if (vertex.y > top) {
				top = vertex.y;
				headZ = vertex.z;
			}
		}
	});
	const bins = new Array<number>(FLOOR_BINS).fill(0);
	for (const y of heights) bins[Math.min(FLOOR_BINS - 1, Math.floor(((y - bottom) / (top - bottom)) * FLOOR_BINS))]++;
	const densest = bins.indexOf(Math.max(...bins));
	const floor = bottom + ((densest + 0.5) / FLOOR_BINS) * (top - bottom);
	const bounds = new Box3().setFromObject(model);
	return { floor, top, headZ, centerZ: (bounds.min.z + bounds.max.z) / 2 };
}

export async function loadSphinx(url: string, placement: SphinxPlacement, material: Material): Promise<Group> {
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const gltf = await loader.loadAsync(url);
	const model = gltf.scene;
	model.updateMatrixWorld(true);
	const survey = surveyModel(model);
	const bounds = new Box3().setFromObject(model);
	const center = bounds.getCenter(new Vector3());
	model.traverse((object) => {
		const mesh = object as Mesh;
		if (mesh.isMesh) mesh.material = material;
	});

	model.position.set(-center.x, -survey.floor, -center.z);
	const oriented = new Group();
	oriented.add(model);
	oriented.rotation.y = survey.headZ > survey.centerZ ? Math.PI / 2 : -Math.PI / 2;
	oriented.scale.setScalar(placement.height / (survey.top - survey.floor));

	const root = new Group();
	root.name = 'sphinx';
	root.add(oriented);
	root.position.set(placement.x, placement.ground, placement.z);
	return root;
}
