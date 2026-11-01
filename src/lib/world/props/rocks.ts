import { Euler, Group, InstancedMesh, type Material, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { createRockGeometry } from './rock-geometry.ts';
import { ROCK_VARIANTS, type RockInstance } from './rock-scatter.ts';

const SINK = 0.18;

export function createRockField(
	rocks: readonly RockInstance[],
	groundAt: (x: number, z: number) => number,
	material: Material
): Group {
	const group = new Group();
	group.name = 'rocks';
	const matrix = new Matrix4();
	const rotation = new Quaternion();
	const euler = new Euler();
	const position = new Vector3();
	const scale = new Vector3();
	ROCK_VARIANTS.forEach((variant, index) => {
		const instances = rocks.filter((rock) => rock.variant === index);
		if (instances.length === 0) return;
		const mesh = new InstancedMesh(createRockGeometry(variant.shape, variant.seed), material, instances.length);
		mesh.name = variant.id;
		instances.forEach((rock, i) => {
			const size = variant.size * rock.scale;
			position.set(rock.x, groundAt(rock.x, rock.z) - size * SINK, rock.z);
			rotation.setFromEuler(euler.set(rock.tiltX, rock.yaw, rock.tiltZ));
			scale.setScalar(size);
			mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
	});
	return group;
}

export function disposeRockField(group: Group): void {
	group.traverse((object) => {
		const mesh = object as InstancedMesh;
		if (mesh.isInstancedMesh) {
			mesh.geometry.dispose();
			mesh.dispose();
		}
	});
}
