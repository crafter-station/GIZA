import gsap from 'gsap';
import Stats from 'stats-gl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
	CapsuleGeometry,
	Mesh,
	MeshStandardNodeMaterial,
	PerspectiveCamera,
	Raycaster,
	Scene,
	Vector2,
	Vector3,
	WebGPURenderer
} from 'three/webgpu';
import type { Flags } from '../app/flags.ts';
import { type Backend, clampTier, initialTier, TIER_SETTINGS, type Tier, tierAfterBenchmark } from '../app/quality.ts';
import { type EngineState, engineState } from '../app/state.ts';
import { KHUFU_SURVIVING_COURSES_M } from '../data/khufu-courses.ts';
import { ALL_PYRAMIDS, FLATTENED_FOOTPRINTS, PYRAMIDS, SPHINX_PLACEMENT } from '../data/layout.ts';
import { DERIVED, KHUFU } from '../data/pyramids.ts';
import { createLimestoneMaterial } from '../materials/limestone.ts';
import { createMasonryMaterial } from '../materials/masonry.ts';
import { createBasaltMaterial, createGraniteMaterial, createPitMaterial } from '../materials/ruins.ts';
import { ANTICIPATION_SECONDS, BlockField, MAX_PHYSICS_BODIES, NO_BLOCK } from '../monuments/blocks/block-field.ts';
import type { BlockLayout, BlockLayoutRequest } from '../monuments/blocks/layout.ts';
import { createComplex, disposeComplex } from '../monuments/complex/complex.ts';
import { buildComplexLayout, complexExclusions } from '../monuments/complex/layout.ts';
import { pyramidDesigns } from '../monuments/pyramid/designs.ts';
import {
	createPyramidObject,
	farGeometry,
	generateInWorker,
	geometryFromMeshData
} from '../monuments/pyramid/pyramid-mesh.ts';
import { loadSphinx } from '../monuments/sphinx/sphinx.ts';
import { BODY_STRIDE } from '../physics/protocol.ts';
import { CHAPTERS, resolveCameraKeys } from '../tour/chapters.ts';
import { TourDirector } from '../tour/director.ts';
import { Environment } from '../world/atmosphere/environment.ts';
import type { LightingMode } from '../world/atmosphere/lighting.ts';
import { scatterRocks } from '../world/props/rock-scatter.ts';
import { createRockField, disposeRockField } from '../world/props/rocks.ts';
import { createGroundSampler } from '../world/terrain/relief.ts';
import { flattenFootprints } from '../world/terrain/shape.ts';
import { loadHeightmap, Terrain } from '../world/terrain/terrain.ts';
import { FrameStats } from './frame-stats.ts';
import { GpuPicker } from './picking.ts';
import { AtmospherePipeline } from './render-pipeline.ts';

export interface Engine {
	deconstruct(): void;
	reassemble(): void;
	clearSelection(): void;
	goToChapter(index: number): void;
	enterFree(): void;
	exitFree(): void;
	setLighting(mode: LightingMode): void;
	setXray(course: number | null): void;
	setForceField(enabled: boolean): void;
	inspect(index: number | null): void;
	collapse(): Promise<void>;
	dispose(): void;
}

const MAX_DT = 0.05;
const BENCHMARK_WARMUP_FRAMES = 30;
const BENCHMARK_FRAMES = 90;
const CLICK_TOLERANCE_PX = 5;
const INSPECT_DISTANCE = 14;
const WEBGL_PHYSICS_BODIES = 800;

const KHUFU_SHAPE = {
	baseSide: KHUFU.baseSide.value,
	originalHeight: KHUFU.originalHeight.value,
	courses: KHUFU_SURVIVING_COURSES_M,
	coreInset: 1.2
};

function patch(partial: Partial<EngineState>): void {
	engineState.update((state) => ({ ...state, ...partial }));
}

function publish(attribute: 'engine' | 'backend' | 'tier' | 'quality' | 'perf' | 'sphinx', value: string): void {
	document.documentElement.dataset[attribute] = value;
}

async function yieldToMain(): Promise<void> {
	const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
	if (scheduler?.yield) await scheduler.yield();
	else await new Promise((resolve) => setTimeout(resolve, 0));
}

function requestLayout(worker: Worker, request: BlockLayoutRequest): Promise<BlockLayout> {
	return new Promise((resolve, reject) => {
		worker.onmessage = (event: MessageEvent<BlockLayout>) => resolve(event.data);
		worker.onerror = (event) => reject(new Error(event.message || 'Block layout worker failed'));
		worker.postMessage(request);
	});
}

export async function startEngine(canvas: HTMLCanvasElement, flags: Flags): Promise<Engine> {
	publish('engine', 'loading');
	patch({ status: 'loading', progress: 0.05, step: 'Starting the renderer' });

	const renderer = new WebGPURenderer({
		canvas,
		antialias: false,
		powerPreference: 'high-performance',
		forceWebGL: flags.backend === 'webgl',
		trackTimestamp: flags.perf
	});
	await renderer.init();
	const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
	publish('backend', backend);
	renderer.onDeviceLost = (info) => {
		renderer.setAnimationLoop(null);
		publish('engine', 'error');
		patch({ status: 'error', error: `The graphics device was lost (${info.reason ?? 'unknown'}). Reload the page.` });
	};

	patch({ progress: 0.1, step: 'Shaping the plateau' });
	const heightmap = await loadHeightmap(document.baseURI);
	const shaped = flattenFootprints(heightmap.heights, heightmap.meta, FLATTENED_FOOTPRINTS);
	const groundAt = createGroundSampler(shaped, heightmap.meta);
	await yieldToMain();

	const scene = new Scene();
	const terrain = new Terrain(shaped, heightmap.meta);
	terrain.object.traverse((object) => {
		if ((object as Mesh).isMesh) object.receiveShadow = true;
	});
	scene.add(terrain.object);

	const stone = new MeshStandardNodeMaterial({ color: 0xdcc9a6, roughness: 0.95 });
	const startTier = clampTier(flags.tier ?? initialTier(backend, matchMedia('(pointer: coarse)').matches), backend);
	const masonry = createMasonryMaterial();
	patch({ progress: 0.12, step: 'Raising the pyramids' });
	const placedPyramids = pyramidDesigns(PYRAMIDS);
	const pyramidMeshes = await generateInWorker(placedPyramids.map((placed) => placed.design));
	const platformOf = (id: string) => shaped.platforms[ALL_PYRAMIDS.findIndex((pyramid) => pyramid.id === id)];
	const pyramidObjects = placedPyramids.map((placed, i) => {
		const object = createPyramidObject(
			placed.id,
			geometryFromMeshData(pyramidMeshes[i]),
			farGeometry(placed.volume),
			placed.lodDistance * TIER_SETTINGS[startTier].pyramidDetail,
			masonry
		);
		object.position.set(placed.volume.x, platformOf(placed.id), placed.volume.z);
		scene.add(object);
		return object;
	});
	const khufuVolume = pyramidObjects[placedPyramids.findIndex((placed) => placed.id === 'khufu')];

	const camera = new PerspectiveCamera(45, 1, 1, 20_000);
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.maxPolarAngle = Math.PI * 0.49;
	controls.minDistance = 40;
	controls.maxDistance = 4000;
	const director = new TourDirector(
		camera,
		controls,
		resolveCameraKeys(CHAPTERS, groundAt),
		CHAPTERS.length,
		flags.t,
		flags.cam
	);

	const worker = new Worker(new URL('../monuments/blocks/layout.worker.ts', import.meta.url), { type: 'module' });
	const picker = new GpuPicker();
	const frames = new FrameStats();
	const stats = flags.perf ? new Stats({ trackGPU: true, horizontal: false }) : null;
	if (stats) {
		Object.assign(stats.dom.style, { top: 'auto', left: 'auto', right: '0', bottom: '0' });
		document.body.append(stats.dom);
		await stats.init(renderer);
	}

	let field: BlockField | null = null;
	let tier: Tier = startTier;
	const complexLayout = buildComplexLayout();
	const rockMaterial = createLimestoneMaterial();
	const slopeAt = (x: number, z: number) =>
		Math.hypot(groundAt(x + 4, z) - groundAt(x - 4, z), groundAt(x, z + 4) - groundAt(x, z - 4)) / 8;
	const rocks = createRockField(
		scatterRocks({
			count: TIER_SETTINGS[tier].rockCount,
			seed: 2589,
			pyramids: PYRAMIDS,
			exclusions: [
				{ x: SPHINX_PLACEMENT.x, z: SPHINX_PLACEMENT.z, halfX: 60, halfZ: 35 },
				...complexExclusions(complexLayout)
			],
			field: { x: -250, z: 450, radius: 1400 },
			slopeAt
		}),
		groundAt,
		rockMaterial
	);
	scene.add(rocks);
	const ruinMaterials = {
		limestone: createLimestoneMaterial(),
		pit: createPitMaterial(),
		basalt: createBasaltMaterial(),
		granite: createGraniteMaterial()
	};
	const complex = createComplex(complexLayout, groundAt, ruinMaterials);
	scene.add(complex);
	const environment = new Environment(scene, renderer, camera, tier);
	environment.setMode(flags.lighting);
	document.documentElement.dataset.lighting = flags.lighting;
	director.update(0, 0);
	environment.update(director.t, true);
	let pipeline = new AtmospherePipeline(renderer, scene, camera, environment, tier, flags.noAo);
	let pipelineTier = tier;
	let disposed = false;

	const resize = () => {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (width === 0 || height === 0) return;
		renderer.setPixelRatio(Math.min(devicePixelRatio, TIER_SETTINGS[tier].maxPixelRatio));
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		pipeline.resize(width, height);
	};
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(canvas);

	const buildField = async (nextTier: Tier, progressFrom: number) => {
		tier = nextTier;
		pyramidObjects.forEach((object, i) => {
			object.levels[1].distance = placedPyramids[i].lodDistance * TIER_SETTINGS[tier].pyramidDetail;
		});
		publish('tier', tier);
		patch({ tier, progress: progressFrom, step: `Cutting blocks (${tier})` });
		const layout = await requestLayout(worker, {
			shape: KHUFU_SHAPE,
			targetCount: TIER_SETTINGS[tier].blockTarget,
			rows: 2,
			seed: 2560,
			coreShare: 0.15,
			coursesPerCoreLayer: 10,
			cubicMetresPerBlock: DERIVED.cubicMetresPerBlock.value
		});
		patch({ progress: progressFrom + 0.2, step: 'Uploading blocks to the GPU' });
		await yieldToMain();
		const wasDeconstructed = field?.deconstructed ?? false;
		if (field) {
			scene.remove(field.mesh);
			field.dispose();
		}
		field = new BlockField(layout);
		field.mesh.castShadow = true;
		field.mesh.receiveShadow = true;
		field.placeAt(khufuVolume.position.x, khufuVolume.position.y, khufuVolume.position.z);
		field.setDeconstructed(wasDeconstructed);
		scene.add(field.mesh);
		picker.setTarget(field.pickMesh);
		resize();
		patch({ blockCount: layout.count, coreRatio: layout.blocksPerCoreCell, hovered: null, selected: null });
		patch({ progress: progressFrom + 0.3, step: 'Compiling shaders' });
		await renderer.compileAsync(scene, camera);
		field.step(renderer, 0);
		if (pipelineTier !== tier) {
			pipeline.dispose();
			environment.setQuality(tier);
			pipeline = new AtmospherePipeline(renderer, scene, camera, environment, tier, flags.noAo);
			pipelineTier = tier;
		}
		await pipeline.warmup(renderer);
		await yieldToMain();
	};

	let last = -1;
	let benchmarking = !flags.tier;
	let warmupFrames = 0;
	let lastPublished = 0;

	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const scale = new Mesh(new CapsuleGeometry(0.22, 1.31, 4, 12), new MeshStandardNodeMaterial({ color: 0x3b2f25 }));
	scale.name = 'human-scale';
	scale.visible = false;
	scene.add(scale);
	const forward = new Vector3();
	const ray = new Raycaster();
	const pointer = new Vector2();
	let forceField = false;
	const physicsWorker = new Worker(new URL('../physics/collapse.worker.ts', import.meta.url), { type: 'module' });
	physicsWorker.onmessage = (event: MessageEvent<Float32Array>) => field?.applyPhysics(event.data);
	const stopCollapse = () => {
		physicsWorker.postMessage({ type: 'stop' });
		field?.stopPhysics();
		patch({ collapsed: false });
	};
	let inspecting: number | null = null;
	const blocksVisible = () => !!field && (benchmarking || !field.settled || field.xrayActive);
	const updateInspector = () => {
		if (!field || inspecting === null) return;
		camera.getWorldDirection(forward);
		const target = camera.position.clone().addScaledVector(forward, INSPECT_DISTANCE).sub(field.mesh.position);
		field.inspectTarget.value.copy(target);
		const info = field.info(inspecting);
		scale.position
			.copy(target)
			.add(field.mesh.position)
			.add(new Vector3(info.size[0] / 2 + 1.2, -info.size[1] / 2 + 0.875, 0).applyQuaternion(camera.quaternion));
	};

	const frame = (time: number) => {
		if (disposed || document.hidden || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
			last = -1;
			return;
		}
		const dt = last < 0 ? 0 : Math.min(Math.max(time - last, 0) / 1000, MAX_DT);
		if (last >= 0) frames.record(Math.max(time - last, 0));
		last = Math.max(last, time);
		director.update(time, dt);
		terrain.update(camera);
		gsap.updateRoot(time / 1000);
		const showBlocks = blocksVisible();
		khufuVolume.visible = !showBlocks;
		if (field) {
			field.mesh.visible = showBlocks;
			if (showBlocks) {
				updateInspector();
				field.step(renderer, dt);
			}
		}
		environment.update(director.t);
		pipeline.render(director.t);
		stats?.update();
		if (flags.perf && time - lastPublished > 1000) {
			lastPublished = time;
			const memory = renderer.info.memory as { geometries: number; textures: number };
			publish(
				'perf',
				JSON.stringify({
					...frames.summary(),
					backend,
					tier,
					blocks: field?.layout.count ?? 0,
					geometries: memory.geometries,
					textures: memory.textures
				})
			);
		}
		if (benchmarking && ++warmupFrames === BENCHMARK_WARMUP_FRAMES) frames.reset();
		if (benchmarking && warmupFrames > BENCHMARK_WARMUP_FRAMES && frames.count >= BENCHMARK_FRAMES)
			void finishBenchmark();
	};

	const finishBenchmark = async () => {
		benchmarking = false;
		const lower = tierAfterBenchmark(tier, frames.summary().medianMs);
		if (lower) {
			await buildField(lower, 0.5);
			warmupFrames = 0;
			benchmarking = true;
			return;
		}
		publish('quality', 'locked');
	};

	let pointerDown: { x: number; y: number } | null = null;
	const pickAt = async (event: PointerEvent): Promise<number | null | undefined> => {
		if (!field || !blocksVisible()) return undefined;
		const rect = canvas.getBoundingClientRect();
		return picker.pick(renderer, camera, event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
	};
	const aimField = (event: PointerEvent) => {
		if (!field) return;
		const rect = canvas.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		ray.setFromCamera(pointer, camera);
		field.fieldOrigin.value.copy(ray.ray.origin).sub(field.mesh.position);
		field.fieldDirection.value.copy(ray.ray.direction);
		field.fieldStrength.value = 1;
	};
	const onPointerMove = async (event: PointerEvent) => {
		if (forceField && event.buttons !== 0) {
			aimField(event);
			return;
		}
		if (event.buttons !== 0 || !field) return;
		const index = await pickAt(event);
		if (index === undefined || !field) return;
		field.hovered.value = index ?? NO_BLOCK;
		patch({ hovered: index === null ? null : field.info(index) });
	};
	const onPointerDown = (event: PointerEvent) => {
		pointerDown = { x: event.clientX, y: event.clientY };
	};
	const onPointerUp = async (event: PointerEvent) => {
		const start = pointerDown;
		pointerDown = null;
		if (field) field.fieldStrength.value = 0;
		if (forceField) return;
		if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE_PX) return;
		const index = await pickAt(event);
		if (index === undefined || !field) return;
		field.selected.value = index ?? NO_BLOCK;
		patch({ selected: index === null ? null : field.info(index) });
	};
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointerup', onPointerUp);

	gsap.ticker.remove(gsap.updateRoot);
	await buildField(tier, 0.2);
	renderer.setAnimationLoop(frame);
	publish('quality', benchmarking ? 'measuring' : 'locked');
	publish('engine', 'ready');
	patch({ backend, status: 'ready', progress: 1, step: 'Ready' });

	publish('sphinx', 'loading');
	const sphinxReady = loadSphinx(
		new URL('models/great-sphinx.glb', document.baseURI).href,
		{
			x: SPHINX_PLACEMENT.x,
			z: SPHINX_PLACEMENT.z,
			ground: groundAt(SPHINX_PLACEMENT.x, SPHINX_PLACEMENT.z),
			height: SPHINX_PLACEMENT.height
		},
		stone
	)
		.then(async (sphinx) => {
			if (disposed) {
				sphinx.traverse((object) => {
					if ((object as Mesh).isMesh) (object as Mesh).geometry.dispose();
				});
				return null;
			}
			sphinx.traverse((object) => {
				if ((object as Mesh).isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});
			scene.add(sphinx);
			await renderer.compileAsync(scene, camera);
			publish('sphinx', 'ready');
			return sphinx;
		})
		.catch((error: unknown) => {
			publish('sphinx', 'error');
			console.warn('The Sphinx model failed to load', error);
			return null;
		});

	const setMode = (deconstructed: boolean) => {
		if (!field) return;
		if (reducedMotion) {
			field.setXray(deconstructed ? Math.round(field.layout.courses / 2) : null);
			patch({
				blockMode: deconstructed ? 'deconstructed' : 'assembled',
				xray: deconstructed ? Math.round(field.layout.courses / 2) : null
			});
			return;
		}
		if (!deconstructed) {
			stopCollapse();
			inspecting = null;
			field.inspected.value = NO_BLOCK;
			scale.visible = false;
			patch({ inspecting: null });
		}
		if (deconstructed) {
			gsap.fromTo(
				field.anticipation,
				{ value: 0 },
				{ value: 1, duration: ANTICIPATION_SECONDS / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' }
			);
			director.shake(ANTICIPATION_SECONDS, 0.35);
		}
		field.setDeconstructed(deconstructed);
		if (!deconstructed) {
			field.selected.value = NO_BLOCK;
			field.hovered.value = NO_BLOCK;
		}
		patch({
			blockMode: deconstructed ? 'deconstructed' : 'assembled',
			...(deconstructed ? {} : { selected: null, hovered: null })
		});
	};

	return {
		setXray: (course) => {
			field?.setXray(course);
			patch({ xray: course });
		},
		setForceField: (enabled) => {
			forceField = enabled;
			controls.enabled = !enabled && director.isFree;
			if (field && !enabled) field.fieldStrength.value = 0;
			patch({ forceField: enabled });
		},
		inspect: (index) => {
			if (!field) return;
			inspecting = index;
			field.inspected.value = index ?? NO_BLOCK;
			scale.visible = index !== null;
			patch({ inspecting: index === null ? null : field.info(index) });
		},
		collapse: async () => {
			if (!field?.deconstructed || field.physicsActive) return;
			const limit = Math.min(
				MAX_PHYSICS_BODIES,
				backend === 'webgl2' ? WEBGL_PHYSICS_BODIES : TIER_SETTINGS[tier].physicsBodies,
				field.layout.shellCount
			);
			const { positions, rotations } = await field.readTransforms(renderer);
			if (!field.deconstructed) return;
			const indices = new Uint32Array(limit);
			const bodies = new Float32Array(limit * BODY_STRIDE);
			const { size } = field.layout;
			for (let slot = 0; slot < limit; slot++) {
				const block = field.layout.shellCount - limit + slot;
				indices[slot] = block;
				bodies.set(
					[
						positions[block * 4],
						positions[block * 4 + 1],
						positions[block * 4 + 2],
						size[block * 4],
						size[block * 4 + 1],
						size[block * 4 + 2],
						rotations[block * 4],
						rotations[block * 4 + 1],
						rotations[block * 4 + 2],
						rotations[block * 4 + 3]
					],
					slot * BODY_STRIDE
				);
			}
			field.startPhysics(indices);
			physicsWorker.postMessage({ type: 'start', bodies, ground: 0 }, [bodies.buffer]);
			patch({ collapsed: true });
		},
		deconstruct: () => setMode(true),
		reassemble: () => setMode(false),
		clearSelection: () => {
			if (field) field.selected.value = NO_BLOCK;
			patch({ selected: null });
		},
		goToChapter: (index) => director.goToChapter(index),
		enterFree: () => director.enterFree(),
		exitFree: () => director.exitFree(),
		setLighting: (mode) => {
			environment.setMode(mode);
			environment.update(director.t, true);
			pipeline.resetHistory();
			document.documentElement.dataset.lighting = mode;
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			renderer.setAnimationLoop(null);
			gsap.ticker.add(gsap.updateRoot);
			director.dispose();
			resizeObserver.disconnect();
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointerup', onPointerUp);
			worker.terminate();
			physicsWorker.terminate();
			controls.dispose();
			field?.dispose();
			picker.dispose();
			terrain.dispose();
			rockMaterial.dispose();
			disposeRockField(rocks);
			disposeComplex(complex);
			for (const material of Object.values(ruinMaterials)) material.dispose();
			for (const object of pyramidObjects) {
				object.traverse((child) => {
					if ((child as Mesh).isMesh) (child as Mesh).geometry.dispose();
				});
			}
			masonry.dispose();
			scale.geometry.dispose();
			(scale.material as MeshStandardNodeMaterial).dispose();
			stone.dispose();
			void sphinxReady.then((sphinx) =>
				sphinx?.traverse((object) => {
					const mesh = object as Mesh;
					if (mesh.isMesh) mesh.geometry.dispose();
				})
			);
			stats?.dom.remove();
			pipeline.dispose();
			environment.dispose();
			renderer.dispose();
		}
	};
}
