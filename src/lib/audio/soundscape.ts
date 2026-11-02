export interface AmbientMix {
	wind: number;
	sand: number;
	interior: number;
}

const MASTER_LEVEL = 0.7;
const FADE_SECONDS = 0.8;
const GUST_INTERVAL_MS = 1800;
const IMPACT_WINDOW_MS = 70;
const MAX_IMPACTS_PER_WINDOW = 3;

function noiseBuffer(context: BaseAudioContext, seconds: number): AudioBuffer {
	const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
	const data = buffer.getChannelData(0);
	let brown = 0;
	for (let i = 0; i < data.length; i++) {
		const white = Math.random() * 2 - 1;
		brown = (brown + 0.02 * white) / 1.02;
		data[i] = white * 0.5 + brown * 3;
	}
	return buffer;
}

function reverbImpulse(context: BaseAudioContext, seconds: number): AudioBuffer {
	const length = Math.floor(context.sampleRate * seconds);
	const buffer = context.createBuffer(2, length, context.sampleRate);
	for (let channel = 0; channel < 2; channel++) {
		const data = buffer.getChannelData(channel);
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
	}
	return buffer;
}

export class Soundscape {
	private readonly context: AudioContext;
	private readonly master: GainNode;
	private readonly noise: AudioBuffer;
	private readonly windGain: GainNode;
	private readonly windFilter: BiquadFilterNode;
	private readonly sandGain: GainNode;
	private readonly interiorGain: GainNode;
	private readonly reverb: ConvolverNode;
	private readonly sources: AudioScheduledSourceNode[] = [];
	private gustTimer: ReturnType<typeof setInterval>;
	private gust = 0.6;
	private mix: AmbientMix = { wind: 0, sand: 0, interior: 0 };
	private windowStart = 0;
	private impactsInWindow = 0;

	constructor() {
		this.context = new AudioContext();
		this.noise = noiseBuffer(this.context, 4);
		this.master = this.context.createGain();
		this.master.gain.value = 0;
		this.master.connect(this.context.destination);
		this.master.gain.setTargetAtTime(MASTER_LEVEL, this.context.currentTime, FADE_SECONDS);

		this.reverb = this.context.createConvolver();
		this.reverb.buffer = reverbImpulse(this.context, 3.2);
		const reverbReturn = this.context.createGain();
		reverbReturn.gain.value = 0.5;
		this.reverb.connect(reverbReturn).connect(this.master);

		this.windFilter = this.context.createBiquadFilter();
		this.windFilter.type = 'bandpass';
		this.windFilter.frequency.value = 380;
		this.windFilter.Q.value = 0.6;
		this.windGain = this.context.createGain();
		this.windGain.gain.value = 0;
		this.loop(this.windFilter, 1);
		this.windFilter.connect(this.windGain).connect(this.master);

		const sandFilter = this.context.createBiquadFilter();
		sandFilter.type = 'highpass';
		sandFilter.frequency.value = 3800;
		this.sandGain = this.context.createGain();
		this.sandGain.gain.value = 0;
		this.loop(sandFilter, 1.37);
		sandFilter.connect(this.sandGain).connect(this.master);

		const interiorFilter = this.context.createBiquadFilter();
		interiorFilter.type = 'lowpass';
		interiorFilter.frequency.value = 160;
		this.interiorGain = this.context.createGain();
		this.interiorGain.gain.value = 0;
		this.loop(interiorFilter, 0.71);
		interiorFilter.connect(this.interiorGain);
		this.interiorGain.connect(this.master);
		this.interiorGain.connect(this.reverb);

		this.gustTimer = setInterval(() => {
			this.gust = Math.min(1, Math.max(0.25, this.gust + (Math.random() - 0.5) * 0.5));
			this.apply();
		}, GUST_INTERVAL_MS);
	}

	private loop(destination: AudioNode, rate: number): void {
		const source = this.context.createBufferSource();
		source.buffer = this.noise;
		source.loop = true;
		source.playbackRate.value = rate;
		source.connect(destination);
		source.start();
		this.sources.push(source);
	}

	private apply(): void {
		const now = this.context.currentTime;
		this.windGain.gain.setTargetAtTime(this.mix.wind * this.gust * 0.5, now, 1.2);
		this.windFilter.frequency.setTargetAtTime(260 + this.gust * 320, now, 1.5);
		this.sandGain.gain.setTargetAtTime(this.mix.sand * this.gust ** 2 * 0.12, now, 0.9);
		this.interiorGain.gain.setTargetAtTime(this.mix.interior * 0.35, now, 0.6);
	}

	setMix(mix: AmbientMix): void {
		const changed =
			Math.abs(mix.wind - this.mix.wind) > 0.02 ||
			Math.abs(mix.sand - this.mix.sand) > 0.02 ||
			Math.abs(mix.interior - this.mix.interior) > 0.02;
		if (!changed) return;
		this.mix = { ...mix };
		this.apply();
	}

	rumble(seconds: number): void {
		const now = this.context.currentTime;
		const envelope = this.context.createGain();
		envelope.gain.setValueAtTime(0, now);
		envelope.gain.linearRampToValueAtTime(0.9, now + seconds * 0.6);
		envelope.gain.setTargetAtTime(0, now + seconds, 0.8);
		const tone = this.context.createOscillator();
		tone.frequency.value = 34;
		tone.frequency.linearRampToValueAtTime(46, now + seconds);
		const body = this.context.createBufferSource();
		body.buffer = this.noise;
		const lowpass = this.context.createBiquadFilter();
		lowpass.type = 'lowpass';
		lowpass.frequency.value = 120;
		tone.connect(envelope);
		body.connect(lowpass).connect(envelope);
		envelope.connect(this.master);
		envelope.connect(this.reverb);
		const end = now + seconds + 4;
		tone.start(now);
		body.start(now);
		tone.stop(end);
		body.stop(end);
	}

	impact(strength: number): void {
		const nowMs = performance.now();
		if (nowMs - this.windowStart > IMPACT_WINDOW_MS) {
			this.windowStart = nowMs;
			this.impactsInWindow = 0;
		}
		if (this.impactsInWindow >= MAX_IMPACTS_PER_WINDOW) return;
		this.impactsInWindow++;
		const now = this.context.currentTime;
		const level = Math.min(1, strength / 12) * 0.6;
		const envelope = this.context.createGain();
		envelope.gain.setValueAtTime(level, now);
		envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
		const thump = this.context.createBufferSource();
		thump.buffer = this.noise;
		thump.playbackRate.value = 0.5 + Math.random() * 0.4;
		const lowpass = this.context.createBiquadFilter();
		lowpass.type = 'lowpass';
		lowpass.frequency.value = 280 + Math.random() * 360;
		thump.connect(lowpass).connect(envelope).connect(this.master);
		envelope.connect(this.reverb);
		thump.start(now, Math.random() * 3);
		thump.stop(now + 0.4);
	}

	dispose(): void {
		clearInterval(this.gustTimer);
		for (const source of this.sources) source.stop();
		void this.context.close();
	}
}
