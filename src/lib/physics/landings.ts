import { STATE_STRIDE } from './protocol.ts';

const FALLING_SPEED = 3;
const RESTING_SPEED = 0.8;

export class LandingDetector {
	private previousY = new Float32Array(0);
	private previousSpeed = new Float32Array(0);

	reset(): void {
		this.previousY = new Float32Array(0);
		this.previousSpeed = new Float32Array(0);
	}

	detect(state: Float32Array, step: number): number[] {
		const count = state.length / STATE_STRIDE;
		if (this.previousY.length !== count) {
			this.previousY = new Float32Array(count);
			this.previousSpeed = new Float32Array(count);
			for (let i = 0; i < count; i++) this.previousY[i] = state[i * STATE_STRIDE + 1];
			return [];
		}
		const landings: number[] = [];
		for (let i = 0; i < count; i++) {
			const y = state[i * STATE_STRIDE + 1];
			const speed = (y - this.previousY[i]) / step;
			if (this.previousSpeed[i] < -FALLING_SPEED && speed > -RESTING_SPEED) landings.push(-this.previousSpeed[i]);
			this.previousY[i] = y;
			this.previousSpeed[i] = speed;
		}
		return landings;
	}
}
