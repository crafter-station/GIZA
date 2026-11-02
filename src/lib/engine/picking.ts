import { Color, type Object3D, type PerspectiveCamera, RenderTarget, Scene, type WebGPURenderer } from 'three/webgpu';

export class GpuPicker {
	private readonly target = new RenderTarget(1, 1);
	private readonly scene = new Scene();
	private readonly clearColor = new Color();
	private pending = false;

	setTarget(object: Object3D | null): void {
		this.scene.clear();
		if (object) this.scene.add(object);
	}

	async pick(
		renderer: WebGPURenderer,
		camera: PerspectiveCamera,
		x: number,
		y: number,
		width: number,
		height: number
	): Promise<number | null | undefined> {
		if (this.pending || this.scene.children.length === 0) return undefined;
		this.pending = true;
		const previousTarget = renderer.getRenderTarget();
		const previousMrt = renderer.getMRT();
		try {
			renderer.getClearColor(this.clearColor);
			const clearAlpha = renderer.getClearAlpha();
			renderer.setMRT(null);
			camera.setViewOffset(width, height, Math.floor(x), Math.floor(y), 1, 1);
			renderer.setClearColor(0x000000, 0);
			renderer.setRenderTarget(this.target);
			renderer.render(this.scene, camera);
			renderer.setRenderTarget(previousTarget);
			renderer.setMRT(previousMrt);
			renderer.setClearColor(this.clearColor, clearAlpha);
			camera.clearViewOffset();
			const pixel = (await renderer.readRenderTargetPixelsAsync(this.target, 0, 0, 1, 1)) as Uint8Array;
			const id = pixel[0] | (pixel[1] << 8) | (pixel[2] << 16);
			return id === 0 ? null : id - 1;
		} finally {
			this.pending = false;
		}
	}

	dispose(): void {
		this.target.dispose();
	}
}
