export interface FrameSummary {
	frames: number;
	medianMs: number;
	p95Ms: number;
	worstMs: number;
}

export class FrameStats {
	private readonly samples: Float32Array;
	private readonly sorted: Float32Array;
	private written = 0;

	constructor(capacity = 240) {
		this.samples = new Float32Array(capacity);
		this.sorted = new Float32Array(capacity);
	}

	record(frameMs: number): void {
		this.samples[this.written % this.samples.length] = frameMs;
		this.written++;
	}

	get count(): number {
		return Math.min(this.written, this.samples.length);
	}

	reset(): void {
		this.written = 0;
	}

	summary(): FrameSummary {
		const n = this.count;
		if (n === 0) return { frames: 0, medianMs: 0, p95Ms: 0, worstMs: 0 };
		const view = this.sorted.subarray(0, n);
		view.set(this.samples.subarray(0, n));
		view.sort();
		const at = (q: number) => Math.round(view[Math.min(n - 1, Math.floor(q * n))] * 10) / 10;
		return { frames: n, medianMs: at(0.5), p95Ms: at(0.95), worstMs: at(1) };
	}
}
