import { cameraPosition, dot, float, positionWorld } from 'three/tsl';
import type { Node } from 'three/webgpu';

const FORWARD_G = 0.65;
const BACKWARD_G = -0.3;
const FORWARD_WEIGHT = 0.85;
const MAX_PHASE_RATIO = 5;

export const SUN_HAZE_SHARE = 0.55;

function henyeyGreensteinRatio(cosine: Node<'float'>, g: number): Node<'float'> {
	return float(1 - g * g).div(
		float(1 + g * g)
			.sub(cosine.mul(2 * g))
			.pow(1.5)
	);
}

export function dustPhaseRatio(sunDirection: Node<'vec3'>): Node<'float'> {
	const view = positionWorld.sub(cameraPosition).normalize();
	const cosine = dot(view, sunDirection);
	return henyeyGreensteinRatio(cosine, FORWARD_G)
		.mul(FORWARD_WEIGHT)
		.add(henyeyGreensteinRatio(cosine, BACKWARD_G).mul(1 - FORWARD_WEIGHT))
		.min(MAX_PHASE_RATIO);
}
