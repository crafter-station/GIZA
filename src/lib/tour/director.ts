import gsap from 'gsap';
import Lenis from 'lenis';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { type PerspectiveCamera, Vector3 } from 'three/webgpu';
import { tourState } from '../app/state.ts';
import { chapterIndexAt } from './chapters.ts';
import { type CameraKey, type CameraPose, createPose, sampleTrack } from './track.ts';

const FAR_JUMP_CHAPTERS = 2;
const RETURN_SECONDS = 1.2;

export class TourDirector {
	private readonly lenis: Lenis;
	private readonly pose: CameraPose = createPose();
	private readonly target = new Vector3();
	private mode: 'tour' | 'free' = 'tour';
	private returning: gsap.core.Tween | null = null;
	private published = { t: -1, chapter: -1, mode: '' };
	t = 0;
	private shakeStrength = 0;
	private shaking: gsap.core.Tween | null = null;

	constructor(
		private readonly camera: PerspectiveCamera,
		private readonly controls: OrbitControls,
		private readonly keys: readonly CameraKey[],
		private readonly chapterCount: number,
		private readonly fixedT: number | null,
		private readonly fixedPose: readonly number[] | null = null
	) {
		this.lenis = new Lenis({ autoRaf: false, smoothWheel: true });
		this.controls.enabled = false;
		if (fixedT !== null) this.lenis.stop();
	}

	get chapter(): number {
		return chapterIndexAt(this.t, this.chapterCount);
	}

	get isFree(): boolean {
		return this.mode === 'free';
	}

	update(time: number, dt: number): void {
		if (this.fixedT !== null) this.t = Math.min(this.fixedT, this.chapterCount);
		else {
			this.lenis.raf(time);
			this.t = this.lenis.progress * this.chapterCount;
		}
		if (this.mode === 'free') this.controls.update(dt);
		else if (this.fixedPose) this.applyFixedPose(this.fixedPose);
		else if (!this.returning) this.applyPose(this.t);
		this.applyShake(time);
		this.publish();
	}

	goToChapter(index: number): void {
		const chapter = Math.min(Math.max(index, 0), this.chapterCount - 1);
		if (this.mode === 'free') this.exitFree();
		const scroll = ((chapter + 0.5) / this.chapterCount) * this.lenis.limit;
		const immediate = Math.abs(chapter - this.chapter) > FAR_JUMP_CHAPTERS;
		this.lenis.scrollTo(scroll, immediate ? { immediate: true } : { duration: 1.6 });
	}

	enterFree(): void {
		if (this.mode === 'free') return;
		this.returning?.kill();
		this.returning = null;
		this.mode = 'free';
		this.lenis.stop();
		sampleTrack(this.keys, this.t, this.pose);
		this.controls.target.fromArray(this.pose.target);
		this.controls.enabled = true;
		this.publish();
	}

	exitFree(): void {
		if (this.mode === 'tour') return;
		this.mode = 'tour';
		this.controls.enabled = false;
		sampleTrack(this.keys, this.t, this.pose);
		const from = { position: this.camera.position.clone(), target: this.controls.target.clone(), progress: 0 };
		const toPosition = new Vector3().fromArray(this.pose.position);
		const toTarget = new Vector3().fromArray(this.pose.target);
		this.returning = gsap.to(from, {
			progress: 1,
			duration: RETURN_SECONDS,
			ease: 'power2.inOut',
			onUpdate: () => {
				this.camera.position.lerpVectors(from.position, toPosition, from.progress);
				this.target.lerpVectors(from.target, toTarget, from.progress);
				this.camera.lookAt(this.target);
			},
			onComplete: () => {
				this.returning = null;
				if (this.fixedT === null) this.lenis.start();
			}
		});
		this.publish();
	}

	dispose(): void {
		this.shaking?.kill();
		this.returning?.kill();
		this.lenis.destroy();
	}

	private applyFixedPose([x, y, z, tx, ty, tz, fov]: readonly number[]): void {
		this.camera.position.set(x, y, z);
		this.target.set(tx, ty, tz);
		this.camera.lookAt(this.target);
		if (this.camera.fov !== fov) {
			this.camera.fov = fov;
			this.camera.updateProjectionMatrix();
		}
	}

	shake(duration: number, amplitude: number): void {
		const state = { strength: amplitude };
		this.shaking?.kill();
		this.shaking = gsap.to(state, {
			strength: 0,
			duration,
			ease: 'power2.out',
			onUpdate: () => {
				this.shakeStrength = state.strength;
			},
			onComplete: () => {
				this.shakeStrength = 0;
				this.shaking = null;
			}
		});
	}

	private applyShake(time: number): void {
		if (this.shakeStrength <= 0) return;
		const s = this.shakeStrength;
		this.camera.position.x += Math.sin(time * 0.071) * s;
		this.camera.position.y += Math.sin(time * 0.053 + 1.3) * s * 0.6;
		this.camera.position.z += Math.sin(time * 0.067 + 2.1) * s;
	}

	private applyPose(t: number): void {
		sampleTrack(this.keys, t, this.pose);
		this.camera.position.fromArray(this.pose.position);
		this.target.fromArray(this.pose.target);
		this.camera.lookAt(this.target);
		if (Math.abs(this.camera.fov - this.pose.fov) > 1e-3) {
			this.camera.fov = this.pose.fov;
			this.camera.updateProjectionMatrix();
		}
	}

	private publish(): void {
		const chapter = this.chapter;
		if (
			Math.abs(this.t - this.published.t) < 0.002 &&
			chapter === this.published.chapter &&
			this.mode === this.published.mode
		)
			return;
		this.published = { t: this.t, chapter, mode: this.mode };
		tourState.set({ t: this.t, chapter, mode: this.mode });
	}
}
