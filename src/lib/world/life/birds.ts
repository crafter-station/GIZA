import {
	abs,
	color,
	cos,
	float,
	instancedArray,
	instanceIndex,
	normalize,
	positionLocal,
	sin,
	smoothstep,
	time,
	vec3
} from 'three/tsl';
import { DoubleSide, Float32BufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';

export interface Thermal {
	x: number;
	z: number;
	ground: number;
}

const BIRDS_PER_THERMAL = 2;
const WINGSPAN = 1.6;
const ALTITUDE: readonly [number, number] = [70, 190];
const RADIUS: readonly [number, number] = [35, 110];
const ANGULAR_SPEED: readonly [number, number] = [0.08, 0.16];
const BANK = 0.35;
const DIHEDRAL = 0.12;
const FLAP_FREQUENCY = 9;
const FLAP_AMPLITUDE = 0.45;
const KITE = 0x2a221c;

function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function birdGeometry(count: number): InstancedBufferGeometry {
	const half = WINGSPAN / 2;
	const nose = [0, 0, 0.32];
	const tail = [0, 0, -0.3];
	const positions = [...nose, ...tail, -half, 0, -0.12, ...nose, half, 0, -0.12, ...tail];
	const geometry = new InstancedBufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.instanceCount = count;
	return geometry;
}

export function createBirds(thermals: readonly Thermal[], seed: number): Mesh {
	const next = random(seed);
	const count = thermals.length * BIRDS_PER_THERMAL;
	const orbits = new Float32Array(count * 4);
	const motion = new Float32Array(count * 4);
	const span = (range: readonly [number, number]) => range[0] + next() * (range[1] - range[0]);
	thermals.forEach((thermal, t) => {
		for (let b = 0; b < BIRDS_PER_THERMAL; b++) {
			const i = t * BIRDS_PER_THERMAL + b;
			orbits.set([thermal.x, thermal.ground + span(ALTITUDE), thermal.z, span(RADIUS)], i * 4);
			const direction = next() < 0.5 ? -1 : 1;
			motion.set([next() * Math.PI * 2, span(ANGULAR_SPEED) * direction, next() * 100, 0], i * 4);
		}
	});
	const orbit = instancedArray(orbits, 'vec4').element(instanceIndex);
	const move = instancedArray(motion, 'vec4').element(instanceIndex);
	const angle = move.x.add(time.mul(move.y));
	const forward = vec3(sin(angle).negate(), 0, cos(angle)).mul(move.y.sign());
	const inward = vec3(cos(angle).negate(), 0, sin(angle).negate());
	const up = normalize(vec3(0, 1, 0).add(inward.mul(BANK)));
	const right = normalize(forward.cross(up));
	const flapping = smoothstep(0.75, 0.95, sin(time.mul(0.23).add(move.z)));
	const flap = sin(time.mul(FLAP_FREQUENCY).add(move.z)).mul(FLAP_AMPLITUDE, flapping);
	const lift = abs(positionLocal.x).mul(float(DIHEDRAL).add(flap));
	const drift = sin(time.mul(0.11).add(move.z)).mul(6);
	const centre = vec3(orbit.x.add(cos(angle).mul(orbit.w)), orbit.y.add(drift), orbit.z.add(sin(angle).mul(orbit.w)));
	const material = new MeshBasicNodeMaterial({ side: DoubleSide });
	material.positionNode = centre
		.add(right.mul(positionLocal.x))
		.add(up.mul(positionLocal.y.add(lift)))
		.add(forward.mul(positionLocal.z));
	material.colorNode = color(KITE);
	const mesh = new Mesh(birdGeometry(count), material);
	mesh.name = 'kites';
	mesh.frustumCulled = false;
	return mesh;
}

export function disposeBirds(mesh: Mesh): void {
	mesh.geometry.dispose();
	(mesh.material as MeshBasicNodeMaterial).dispose();
}
