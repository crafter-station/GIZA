import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, color, mix } from 'three/tsl';
import {
	Bone,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	MeshStandardNodeMaterial,
	Skeleton,
	SkinnedMesh,
	SphereGeometry,
	Uint16BufferAttribute
} from 'three/webgpu';

export const PERSON_JOINTS = [
	{ name: 'hips', parent: -1, x: 0, y: 0.93, z: 0 },
	{ name: 'spine', parent: 0, x: 0, y: 0.16, z: 0 },
	{ name: 'head', parent: 1, x: 0, y: 0.49, z: 0 },
	{ name: 'leftArm', parent: 1, x: 0.225, y: 0.32, z: 0 },
	{ name: 'leftElbow', parent: 3, x: 0, y: -0.29, z: 0 },
	{ name: 'rightArm', parent: 1, x: -0.225, y: 0.32, z: 0 },
	{ name: 'rightElbow', parent: 5, x: 0, y: -0.29, z: 0 },
	{ name: 'leftLeg', parent: 0, x: 0.105, y: 0, z: 0 },
	{ name: 'leftKnee', parent: 7, x: 0, y: -0.43, z: 0 },
	{ name: 'leftFoot', parent: 8, x: 0, y: -0.43, z: 0 },
	{ name: 'rightLeg', parent: 0, x: -0.105, y: 0, z: 0 },
	{ name: 'rightKnee', parent: 10, x: 0, y: -0.43, z: 0 },
	{ name: 'rightFoot', parent: 11, x: 0, y: -0.43, z: 0 }
] as const;

export type PersonJoint = (typeof PERSON_JOINTS)[number]['name'];
export type PersonRig = Record<PersonJoint, Bone>;

interface ProfileRing {
	y: number;
	x: number;
	z: number;
}

function profile(rings: readonly ProfileRing[], segments: number, folds = 0): BufferGeometry {
	const positions: number[] = [];
	const indices: number[] = [];
	for (let row = 0; row < rings.length; row++) {
		const ring = rings[row];
		for (let i = 0; i <= segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			const ripple = 1 + Math.cos(angle * 12) * folds;
			positions.push(Math.cos(angle) * ring.x * ripple, ring.y, Math.sin(angle) * ring.z * ripple);
			if (row === 0 || i === segments) continue;
			const a = (row - 1) * (segments + 1) + i;
			const b = row * (segments + 1) + i;
			indices.push(a, b, a + 1, a + 1, b, b + 1);
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

export function createPersonGeometry(): BufferGeometry {
	const pieces: BufferGeometry[] = [];
	const tint = new Color();
	const add = (geometry: BufferGeometry, bone: number, hex = 0xffffff, skin = true) => {
		geometry.deleteAttribute('uv');
		const count = geometry.getAttribute('position').count;
		const colors = new Float32Array(count * 3);
		const skinIndices = new Uint16Array(count * 4);
		const skinWeights = new Float32Array(count * 4);
		tint.setHex(hex);
		for (let i = 0; i < count; i++) {
			colors.set([tint.r, tint.g, tint.b], i * 3);
			skinIndices[i * 4] = bone;
			skinWeights[i * 4] = 1;
		}
		geometry.setAttribute('personColor', new Float32BufferAttribute(colors, 3));
		geometry.setAttribute('personSkin', new Float32BufferAttribute(new Float32Array(count).fill(skin ? 1 : 0), 1));
		geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
		geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));
		const flat = geometry.toNonIndexed();
		geometry.dispose();
		pieces.push(flat);
	};
	const ellipsoid = (
		x: number,
		y: number,
		z: number,
		rx: number,
		ry: number,
		rz: number,
		bone: number,
		hex = 0xffffff,
		skin = true,
		segments = 12
	) => {
		const geometry = new SphereGeometry(1, segments, 8);
		geometry.scale(rx, ry, rz);
		geometry.translate(x, y, z);
		add(geometry, bone, hex, skin);
	};
	const limb = (x: number, top: number, length: number, radii: readonly [number, number, number], bone: number) => {
		const geometry = profile(
			[
				{ y: top - length, x: radii[2], z: radii[2] },
				{ y: top - length * 0.5, x: radii[1], z: radii[1] * 0.9 },
				{ y: top, x: radii[0], z: radii[0] }
			],
			10
		);
		geometry.translate(x, 0, 0);
		add(geometry, bone);
	};
	add(
		profile(
			[
				{ y: 0.96, x: 0.13, z: 0.085 },
				{ y: 1.08, x: 0.135, z: 0.09 },
				{ y: 1.24, x: 0.18, z: 0.105 },
				{ y: 1.37, x: 0.205, z: 0.105 },
				{ y: 1.43, x: 0.155, z: 0.08 },
				{ y: 1.47, x: 0.065, z: 0.06 }
			],
			20
		),
		1
	);
	ellipsoid(0, 1.48, 0, 0.06, 0.075, 0.058, 2);
	ellipsoid(0, 1.61, 0, 0.105, 0.14, 0.108, 2, 0xffffff, true, 16);
	ellipsoid(0, 1.555, 0.055, 0.073, 0.07, 0.065, 2);
	ellipsoid(0, 1.602, 0.103, 0.023, 0.04, 0.032, 2);
	ellipsoid(0, 1.558, 0.109, 0.032, 0.008, 0.009, 2, 0x58392c, false);
	for (const side of [-1, 1]) {
		ellipsoid(side * 0.104, 1.61, 0.002, 0.018, 0.032, 0.021, 2);
		ellipsoid(side * 0.043, 1.63, 0.096, 0.022, 0.009, 0.009, 2, 0x30251f, false, 8);
		ellipsoid(side * 0.044, 1.649, 0.094, 0.026, 0.005, 0.008, 2, 0x392b22, false, 8);
		const arm = side > 0 ? 3 : 5;
		const leg = side > 0 ? 7 : 10;
		ellipsoid(side * 0.215, 1.41, 0, 0.084, 0.085, 0.083, arm);
		limb(side * 0.225, 1.41, 0.29, [0.065, 0.061, 0.043], arm);
		ellipsoid(side * 0.225, 1.12, 0, 0.045, 0.045, 0.045, arm + 1);
		limb(side * 0.225, 1.12, 0.27, [0.045, 0.048, 0.028], arm + 1);
		ellipsoid(side * 0.225, 0.805, 0.008, 0.04, 0.067, 0.025, arm + 1);
		ellipsoid(side * 0.195, 0.83, 0.026, 0.018, 0.037, 0.018, arm + 1);
		limb(side * 0.105, 0.93, 0.43, [0.093, 0.082, 0.052], leg);
		ellipsoid(side * 0.105, 0.5, 0, 0.055, 0.055, 0.06, leg + 1);
		limb(side * 0.105, 0.5, 0.43, [0.05, 0.065, 0.032], leg + 1);
		ellipsoid(side * 0.105, 0.065, 0.055, 0.052, 0.05, 0.12, leg + 2);
	}
	const skirt = profile(
		[
			{ y: 0.68, x: 0.23, z: 0.14 },
			{ y: 0.8, x: 0.205, z: 0.12 },
			{ y: 0.98, x: 0.155, z: 0.1 }
		],
		48,
		0.035
	);
	add(skirt, 0, 0xe5d7b5, false);
	add(
		profile(
			[
				{ y: 0.95, x: 0.158, z: 0.104 },
				{ y: 0.995, x: 0.158, z: 0.104 }
			],
			20
		),
		0,
		0xb5a17b,
		false
	);
	const hair = new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, 1.5);
	hair.scale(0.108, 0.144, 0.111);
	hair.translate(0, 1.615, -0.005);
	add(hair, 2, 0x302923, false);
	const geometry = mergeGeometries(pieces);
	for (const piece of pieces) piece.dispose();
	geometry.computeBoundingSphere();
	return geometry;
}

export function createPersonMaterial(skin: number): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({ roughness: 0.93, metalness: 0 });
	material.colorNode = mix(attribute('personColor', 'vec3'), color(skin), attribute('personSkin', 'float'));
	return material;
}

export function createPerson(
	geometry: BufferGeometry,
	material: MeshStandardNodeMaterial
): { mesh: SkinnedMesh; rig: PersonRig } {
	const mesh = new SkinnedMesh(geometry, material);
	mesh.name = 'town-worker';
	const bones = PERSON_JOINTS.map((joint) => {
		const bone = new Bone();
		bone.name = joint.name;
		bone.position.set(joint.x, joint.y, joint.z);
		return bone;
	});
	PERSON_JOINTS.forEach((joint, i) => {
		if (joint.parent < 0) mesh.add(bones[i]);
		else bones[joint.parent].add(bones[i]);
	});
	mesh.bind(new Skeleton(bones));
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.frustumCulled = false;
	return { mesh, rig: Object.fromEntries(bones.map((bone) => [bone.name, bone])) as PersonRig };
}
