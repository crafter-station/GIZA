import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu';

type Signs = readonly [number, number, number];

const CORNERS: readonly Signs[] = [-1, 1].flatMap((x) =>
	[-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as const))
);

export function createChamferedBoxGeometry(chamfer = 0.08): BufferGeometry {
	const inner = 0.5 - chamfer;
	const positions: number[] = [];
	const normals: number[] = [];

	const facePoint = (axis: number, signs: Signs): Vector3 => {
		const point = new Vector3(signs[0] * inner, signs[1] * inner, signs[2] * inner);
		point.setComponent(axis, signs[axis] * 0.5);
		return point;
	};

	const addTriangle = (a: Vector3, b: Vector3, c: Vector3) => {
		const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
		const centroid = new Vector3().add(a).add(b).add(c);
		const inward = normal.dot(centroid) < 0;
		if (inward) normal.negate();
		for (const v of inward ? [a, c, b] : [a, b, c]) {
			positions.push(v.x, v.y, v.z);
			normals.push(normal.x, normal.y, normal.z);
		}
	};

	const addQuad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3) => {
		addTriangle(a, b, c);
		addTriangle(a, c, d);
	};

	for (let axis = 0; axis < 3; axis++) {
		const u = (axis + 1) % 3;
		const v = (axis + 2) % 3;
		for (const side of [-1, 1]) {
			const corner = (su: number, sv: number) => {
				const signs = [0, 0, 0];
				signs[axis] = side;
				signs[u] = su;
				signs[v] = sv;
				return facePoint(axis, signs as unknown as Signs);
			};
			addQuad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
		}
	}

	for (let a = 0; a < 3; a++) {
		for (let b = a + 1; b < 3; b++) {
			const along = 3 - a - b;
			for (const sa of [-1, 1]) {
				for (const sb of [-1, 1]) {
					const signs = (sk: number) => {
						const s = [0, 0, 0];
						s[a] = sa;
						s[b] = sb;
						s[along] = sk;
						return s as unknown as Signs;
					};
					addQuad(facePoint(a, signs(-1)), facePoint(a, signs(1)), facePoint(b, signs(1)), facePoint(b, signs(-1)));
				}
			}
		}
	}

	for (const signs of CORNERS) addTriangle(facePoint(0, signs), facePoint(1, signs), facePoint(2, signs));

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	return geometry;
}
