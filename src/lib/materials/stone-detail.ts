import { abs, cross, dFdx, dFdy, dot, max, normalView, positionView, sign } from 'three/tsl';
import type { Node } from 'three/webgpu';

const MIN_DETERMINANT = 1e-6;

export function surfaceGradientNormal(height: Node<'float'>): Node<'vec3'> {
	const normal = normalView.normalize();
	const dpdx = dFdx(positionView);
	const dpdy = dFdy(positionView);
	const r1 = cross(dpdy, normal);
	const r2 = cross(normal, dpdx);
	const determinant = dot(dpdx, r1);
	const gradient = r1
		.mul(dFdx(height))
		.add(r2.mul(dFdy(height)))
		.mul(sign(determinant));
	return normal
		.mul(max(abs(determinant), MIN_DETERMINANT))
		.sub(gradient)
		.normalize();
}
