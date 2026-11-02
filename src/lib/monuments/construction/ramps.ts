import { color } from 'three/tsl';
import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardNodeMaterial, Vector3 } from 'three/webgpu';
import type { RampId } from '../../data/construction.ts';

export type Point = readonly [number, number, number];

export interface RampSegment {
	from: Point;
	to: Point;
}

export interface RampShape {
	baseSide: number;
	originalHeight: number;
	grade: number;
	width: number;
	internalInset: number;
}

export const MAX_RAMP_SEGMENTS = 96;
const SLAB_THICKNESS = 1.6;
const ZIGZAG_SPAN = 0.7;
const MUD_BRICK = 0x9a7a55;
const INTERNAL = 0xf2c46b;
const SPIRAL_CORNERS: readonly (readonly [number, number])[] = [
	[-1, 1],
	[1, 1],
	[1, -1],
	[-1, -1]
];

function clipped(from: Point, to: Point, height: number): RampSegment {
	if (to[1] <= height) return { from, to };
	const t = (height - from[1]) / (to[1] - from[1]);
	return { from, to: [from[0] + (to[0] - from[0]) * t, height, from[2] + (to[2] - from[2]) * t] };
}

function climb(
	shape: RampShape,
	height: number,
	half: (y: number) => number,
	corner: (leg: number, side: number) => readonly [number, number]
): RampSegment[] {
	const segments: RampSegment[] = [];
	let y = 0;
	for (let leg = 0; segments.length < MAX_RAMP_SEGMENTS && y < height; leg++) {
		const side = half(y);
		if (side <= shape.width) break;
		const next = y + 2 * side * shape.grade;
		const [x0, z0] = corner(leg, side);
		const [x1, z1] = corner(leg + 1, Math.max(half(next), 0));
		segments.push(clipped([x0, y, z0], [x1, next, z1], height));
		y = next;
	}
	return segments;
}

export function rampSegments(id: RampId, shape: RampShape, height: number): RampSegment[] {
	if (height <= 0) return [];
	const faceHalf = (y: number) => (shape.baseSide / 2) * (1 - y / shape.originalHeight);
	const out = shape.width / 2;
	if (id === 'straight') {
		const z = faceHalf(height) + out;
		return [{ from: [0, 0, z + height / shape.grade], to: [0, height, z] }];
	}
	if (id === 'zigzag') {
		return climb(shape, height, faceHalf, (leg, side) => [(leg % 2 === 0 ? -1 : 1) * side * ZIGZAG_SPAN, side + out]);
	}
	const inset = id === 'internal' ? shape.internalInset : -out;
	return climb(
		shape,
		height,
		(y) => faceHalf(y) - inset,
		(leg, side) => {
			const [x, z] = SPIRAL_CORNERS[leg % 4];
			return [x * side, z * side];
		}
	);
}

export class RampModel {
	readonly mesh: InstancedMesh;
	private readonly material: MeshStandardNodeMaterial;
	private readonly matrix = new Matrix4();
	private readonly from = new Vector3();
	private readonly to = new Vector3();
	private readonly along = new Vector3();
	private readonly across = new Vector3();
	private readonly normal = new Vector3();
	private readonly scale = new Vector3();
	private readonly up = new Vector3(0, 1, 0);
	private internal = false;

	constructor(private readonly shape: RampShape) {
		this.material = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
		this.material.colorNode = color(MUD_BRICK);
		this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.material, MAX_RAMP_SEGMENTS);
		this.mesh.name = 'construction-ramp';
		this.mesh.count = 0;
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
	}

	update(id: RampId | null, height: number): void {
		this.setInternal(id === 'internal');
		const segments = id ? rampSegments(id, this.shape, height) : [];
		segments.forEach((segment, index) => {
			this.from.set(...segment.from);
			this.to.set(...segment.to);
			this.along.subVectors(this.to, this.from);
			this.scale.set(this.along.length(), SLAB_THICKNESS, this.shape.width);
			this.along.normalize();
			this.across.crossVectors(this.along, this.up).normalize();
			this.normal.crossVectors(this.across, this.along);
			this.matrix
				.makeBasis(this.along, this.normal, this.across)
				.scale(this.scale)
				.setPosition(this.from.add(this.to).multiplyScalar(0.5));
			this.mesh.setMatrixAt(index, this.matrix);
		});
		this.mesh.count = segments.length;
		this.mesh.instanceMatrix.needsUpdate = true;
	}

	private setInternal(internal: boolean): void {
		if (this.internal === internal) return;
		this.internal = internal;
		this.material.colorNode = color(internal ? INTERNAL : MUD_BRICK);
		this.material.emissiveNode = internal ? color(INTERNAL).mul(0.4) : null;
		this.material.depthTest = !internal;
		this.material.transparent = internal;
		this.material.opacity = internal ? 0.8 : 1;
		this.material.needsUpdate = true;
		this.mesh.renderOrder = internal ? 2 : 0;
		this.mesh.castShadow = !internal;
	}

	dispose(): void {
		this.mesh.geometry.dispose();
		this.material.dispose();
	}
}
