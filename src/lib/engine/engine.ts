import gsap from 'gsap';
import Stats from 'stats-gl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
	CapsuleGeometry,
	Mesh,
	MeshStandardNodeMaterial,
	type Object3D,
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
import { Soundscape } from '../audio/soundscape.ts';
import {
	BLOCK_TARGET_IDS,
	BLOCK_TARGETS,
	type BlockTarget,
	type BlockTargetId,
	courseTopsOf,
	isBlockTargetId
} from '../data/block-targets.ts';
import { courseAtProgress, cumulativeCourseVolume, RAMP_DRAWING, type RampId } from '../data/construction.ts';
import { ALL_PYRAMIDS, FLATTENED_FOOTPRINTS, PYRAMIDS, SPHINX_PLACEMENT } from '../data/layout.ts';
import { DERIVED } from '../data/pyramids.ts';
import { ASHLAR_STYLES, createAshlarMaterial } from '../materials/ashlar.ts';
import { createInteriorMaterials } from '../materials/interior.ts';
import { createLimestoneMaterial } from '../materials/limestone.ts';
import { createMasonryMaterial } from '../materials/masonry.ts';
import { createBasaltMaterial, createPitMaterial } from '../materials/ruins.ts';
import { ANTICIPATION_SECONDS, BlockField, MAX_PHYSICS_BODIES, NO_BLOCK } from '../monuments/blocks/block-field.ts';
import type { BlockLayout, BlockLayoutRequest } from '../monuments/blocks/layout.ts';
import { createComplex, disposeComplex } from '../monuments/complex/complex.ts';
import { buildComplexLayout, complexExclusions } from '../monuments/complex/layout.ts';
import { createCasingGhost, disposeCasingGhost } from '../monuments/construction/casing.ts';
import { RampModel } from '../monuments/construction/ramps.ts';
import { createKhufuInterior } from '../monuments/interiors/khufu-interior.ts';
import { pyramidDesigns } from '../monuments/pyramid/designs.ts';
import {
	createPyramidObject,
	farGeometry,
	generateInWorker,
	geometryFromMeshData
} from '../monuments/pyramid/pyramid-mesh.ts';
import { loadSphinx } from '../monuments/sphinx/sphinx.ts';
import { LandingDetector } from '../physics/landings.ts';
import { BODY_STRIDE, PHYSICS_STEP } from '../physics/protocol.ts';
import { CHAPTERS, resolveCameraKeys } from '../tour/chapters.ts';
import { TourDirector } from '../tour/director.ts';
import { DustMotes, JointDust } from '../world/atmosphere/dust.ts';
import { Environment } from '../world/atmosphere/environment.ts';
import type { LightingMode } from '../world/atmosphere/lighting.ts';
import { AncientReconstruction } from '../world/era/reconstruction.ts';
import { tourEra } from '../world/era/timeline.ts';
import { WorkersTown } from '../world/era/workers-town.ts';
import { createBirds, disposeBirds } from '../world/life/birds.ts';
import { DailyLife } from '../world/life/daily-life.ts';
import { DustDevils } from '../world/life/dust-devils.ts';
import { createBedrockBlocks, quarryBedrock, quarryRocks } from '../world/props/quarry-rocks.ts';
import { scatterRocks } from '../world/props/rock-scatter.ts';
import { createRockField, disposeRockField } from '../world/props/rocks.ts';
import { Torches, torchPositions } from '../world/props/torches.ts';
import { quarryMask } from '../world/terrain/quarry.ts';
import { createGroundSampler } from '../world/terrain/relief.ts';
import { flattenFootprints } from '../world/terrain/shape.ts';
import { loadHeightmap, Terrain } from '../world/terrain/terrain.ts';
import { ValleyLandscape } from '../world/valley/landscape.ts';
import { FrameStats } from './frame-stats.ts';
import { HotspotTracker } from './hotspots.ts';
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
	setBuild(progress: number | null): void;
	setRamp(ramp: RampId | null): void;
	setOrigins(enabled: boolean): void;
	setSound(enabled: boolean): void;
	startDrone(): void;
	setTarget(id: BlockTargetId): Promise<void>;
	focusHotspot(id: string | null): void;
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
const TORCH_SPACING = 40;
const SUN_REFERENCE_INTENSITY = 3.4;
const SAND_HISS_HEIGHT = 120;
const DRONE_CENTER_TOWARD_KHAFRE = 0.35;
const QUARRY_SEED = 2760;
const KEY_PAN_SPEED = 25;
const TOWN_HOTSPOT = 'workers-town';
const TOWN_PREVIEW = 0.35;
const TOWN_FADE_SECONDS = 0.6;
const TARGET_VIEW_DISTANCE = 1.9;
const TARGET_VIEW_HEIGHT = 0.75;
const TARGET_FLIGHT_SECONDS = 2.4;
const BIRD_SEED = 1149;
const VALLEY_SAND_EDGE = 450;
const PYRAMID_CLEARANCE = 170;
const THERMALS: readonly (readonly [number, number])[] = [
	[-150, 200],
	[60, 600],
	[-700, -300],
	[-900, 900],
	[350, -350],
	[-450, 1250]
];

const CORE_INSET = 1.2;

function shapeOf(target: BlockTarget) {
	return {
		baseSide: target.baseSide,
		originalHeight: target.originalHeight,
		courses: target.courses,
		coreInset: CORE_INSET
	};
}

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
	const volumeOf = (id: BlockTargetId) => pyramidObjects[placedPyramids.findIndex((placed) => placed.id === id)];
	let target: BlockTarget = BLOCK_TARGETS.khufu;
	let targetVolume = volumeOf(target.id);
	const hotspots = new HotspotTracker(
		BLOCK_TARGET_IDS.map((id) => ({ id, position: volumeOf(id).position })),
		groundAt
	);

	const camera = new PerspectiveCamera(45, 1, 1, 20_000);
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.screenSpacePanning = false;
	controls.zoomToCursor = true;
	controls.keyPanSpeed = KEY_PAN_SPEED;
	controls.listenToKeyEvents(canvas);
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
				{
					x: SPHINX_PLACEMENT.x,
					z: SPHINX_PLACEMENT.z,
					halfX: SPHINX_PLACEMENT.renderedLength / 2 + 15,
					halfZ: SPHINX_PLACEMENT.renderedWidth / 2 + 15
				},
				...complexExclusions(complexLayout)
			],
			field: { x: -250, z: 450, radius: 1400 },
			slopeAt
		}),
		groundAt,
		rockMaterial
	);
	scene.add(rocks);
	const quarryBlocks = createRockField(quarryRocks(QUARRY_SEED), groundAt, rockMaterial);
	quarryBlocks.name = 'quarry-blocks';
	const quarryBedrockBlocks = createBedrockBlocks(quarryBedrock(QUARRY_SEED), groundAt, rockMaterial);
	scene.add(quarryBlocks, quarryBedrockBlocks);
	const ruinMaterials = {
		limestone: createAshlarMaterial(ASHLAR_STYLES.limestone),
		pit: createPitMaterial(),
		basalt: createBasaltMaterial(),
		granite: createAshlarMaterial(ASHLAR_STYLES.granite)
	};
	const complex = createComplex(complexLayout, groundAt, ruinMaterials);
	scene.add(complex);
	const valley = new ValleyLandscape(groundAt, tier);
	const reconstruction = new AncientReconstruction(PYRAMIDS, platformOf, groundAt);
	const mudbrick = createAshlarMaterial(ASHLAR_STYLES.mudbrick);
	const workersTown = new WorkersTown(groundAt, ruinMaterials.limestone, mudbrick);
	const dailyLife = new DailyLife(groundAt);
	scene.add(valley.group, reconstruction.group, workersTown.wall, workersTown.town, dailyLife.group);
	let townPresence = 0;
	let activeHotspot: string | null = null;
	const updateTown = (dt: number) => {
		const focusedTown = activeHotspot === TOWN_HOTSPOT || activeHotspot === 'daily-life';
		const explored = director.isFree ? (focusedTown ? 1 : TOWN_PREVIEW) : 0;
		const target = Math.max(tourEra(director.t), explored);
		townPresence += (target - townPresence) * (1 - Math.exp(-dt / TOWN_FADE_SECONDS));
		if (Math.abs(target - townPresence) < 0.002) townPresence = target;
		workersTown.setEra(townPresence);
		dailyLife.update(dt, camera, townPresence, tier);
	};
	let renderedEra = -1;
	const updateEra = () => {
		const amount = tourEra(director.t);
		if (Math.abs(amount - renderedEra) < 0.001) return;
		if (Math.abs(amount - renderedEra) > 0.25) pipeline.resetHistory();
		valley.setEra(amount);
		reconstruction.setEra(amount);
		renderedEra = amount;
		document.documentElement.dataset.era = String(Math.round(amount * 100));
	};
	const environment = new Environment(scene, renderer, camera, tier);
	environment.setMode(flags.lighting);
	document.documentElement.dataset.lighting = flags.lighting;
	director.update(0, 0);
	environment.update(director.t, true);
	let pipeline = new AtmospherePipeline(renderer, scene, camera, environment, tier, flags.noAo);
	let pipelineTier = tier;
	const torches = new Torches(
		torchPositions(complexLayout.causeways, TORCH_SPACING),
		groundAt,
		backend === 'webgpu' ? TIER_SETTINGS[tier].torchLights : 0
	);
	scene.add(torches.group, torches.flames, ...torches.lights);
	const motes = new DustMotes(TIER_SETTINGS[tier].dustMotes);
	scene.add(motes.mesh);
	const lively = tier !== 'low' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
	const birds = lively
		? createBirds(
				THERMALS.map(([x, z]) => ({ x, z, ground: groundAt(x, z) })),
				BIRD_SEED
			)
		: null;
	const isSand = (x: number, z: number) =>
		x < VALLEY_SAND_EDGE &&
		quarryMask(x, z) === 0 &&
		placedPyramids.every((placed) => Math.hypot(x - placed.volume.x, z - placed.volume.z) > PYRAMID_CLEARANCE);
	const dustDevils = lively ? new DustDevils(groundAt, isSand) : null;
	if (birds) scene.add(birds);
	if (dustDevils) scene.add(dustDevils.mesh);
	let soundscape: Soundscape | null = null;
	const landings = new LandingDetector();
	const updateAtmosphere = (dt: number) => {
		const night = environment.look.night;
		const daylight = Math.min(environment.sun.intensity / SUN_REFERENCE_INTENSITY, 1);
		torches.update(camera.position, night);
		motes.step(renderer, dt, camera.position, environment.sunDirection, daylight);
		dressing.jointDust.step(renderer, dt, 0.25 + daylight * 0.75);
		dustDevils?.update(dt, camera.position, daylight * (1 - night));
		if (!soundscape) return;
		const height = camera.position.y - groundAt(camera.position.x, camera.position.z);
		soundscape.setMix({
			wind: 1 - night * 0.45,
			sand: (1 - night) * Math.max(0, 1 - height / SAND_HISS_HEIGHT),
			interior: interior.visible ? 1 : 0
		});
	};
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
		terrain.setQuality(TIER_SETTINGS[tier].terrainDetailFar, TIER_SETTINGS[tier].terrainLodBias);
		patch({ tier, progress: progressFrom, step: `Cutting blocks (${tier})` });
		const layout = await requestLayout(worker, {
			shape: shapeOf(target),
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
		const cuts = field && {
			xray: field.xrayCourse.value,
			build: field.buildCourse.value,
			section: field.section.value
		};
		if (field) {
			scene.remove(field.mesh);
			field.dispose();
		}
		field = new BlockField(layout);
		field.mesh.castShadow = true;
		field.mesh.receiveShadow = true;
		field.placeAt(targetVolume.position.x, targetVolume.position.y, targetVolume.position.z);
		field.setDeconstructed(wasDeconstructed);
		if (cuts) {
			field.xrayCourse.value = cuts.xray;
			field.buildCourse.value = cuts.build;
			field.section.value = cuts.section;
		}
		scene.add(field.mesh);
		picker.setTarget(field.pickMesh);
		resize();
		patch({ blockCount: layout.count, coreRatio: layout.blocksPerCoreCell, hovered: null, selected: null });
		patch({ progress: progressFrom + 0.3, step: 'Compiling shaders' });
		if (!looping) await renderer.compileAsync(scene, camera);
		field.step(renderer, 0);
		if (pipelineTier !== tier) {
			pipeline.dispose();
			environment.setQuality(tier);
			pipeline = new AtmospherePipeline(renderer, scene, camera, environment, tier, flags.noAo);
			pipelineTier = tier;
		}
		if (!looping) await pipeline.warmup(renderer);
		await yieldToMain();
	};

	let looping = false;
	let last = -1;
	let benchmarking = !flags.tier;
	let warmupFrames = 0;
	let lastPublished = 0;

	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const interiorMaterials = createInteriorMaterials();
	const interior = createKhufuInterior(interiorMaterials);
	interior.position.copy(khufuVolume.position);
	interior.visible = false;
	scene.add(interior);
	let courseTops = courseTopsOf(target.courses);
	let courseVolumes = cumulativeCourseVolume(target.courses, target.baseSide, target.originalHeight);
	const heightOfCourse = (course: number) => {
		const whole = Math.floor(course);
		if (whole >= courseTops.length) return Infinity;
		const below = whole === 0 ? 0 : courseTops[whole - 1];
		return below + (courseTops[whole] - below) * (course - whole);
	};
	const dressTarget = () => {
		const ramps = new RampModel({ ...shapeOf(target), ...RAMP_DRAWING.value });
		const casing = createCasingGhost(target.baseSide, target.originalHeight);
		const jointDust = new JointDust(TIER_SETTINGS[tier].jointDust, {
			baseSide: target.baseSide,
			height: target.originalHeight
		});
		for (const object of [ramps.mesh, casing, jointDust.mesh]) {
			object.position.copy(targetVolume.position);
			scene.add(object);
		}
		return { ramps, casing, jointDust };
	};
	const undressTarget = (dressed: ReturnType<typeof dressTarget>) => {
		for (const object of [dressed.ramps.mesh, dressed.casing, dressed.jointDust.mesh]) scene.remove(object);
		dressed.ramps.dispose();
		disposeCasingGhost(dressed.casing);
		dressed.jointDust.dispose();
	};
	let dressing = dressTarget();
	let ramp: RampId | null = 'spiral';
	let buildProgress: number | null = null;
	const updateRamps = () => {
		const course = buildProgress === null ? null : courseAtProgress(courseVolumes, buildProgress);
		field?.setBuild(course);
		dressing.ramps.update(course === null ? null : ramp, course === null ? 0 : heightOfCourse(course));
	};
	const updateInterior = (showBlocks: boolean) => {
		const open = target.interior && showBlocks && !!field && (field.deconstructed || field.sectioned);
		interior.visible = open;
		if (!open || !field) return;
		const cut = heightOfCourse(Math.min(Math.round(field.xrayCourse.value), field.buildCourse.value));
		for (const piece of interior.children) piece.visible = piece.position.y - piece.scale.y / 2 < cut;
	};
	const scale = new Mesh(new CapsuleGeometry(0.22, 1.31, 4, 12), new MeshStandardNodeMaterial({ color: 0x3b2f25 }));
	scale.name = 'human-scale';
	scale.visible = false;
	scene.add(scale);
	const forward = new Vector3();
	const ray = new Raycaster();
	const pointer = new Vector2();
	let forceField = false;
	const physicsWorker = new Worker(new URL('../physics/collapse.worker.ts', import.meta.url), { type: 'module' });
	physicsWorker.onmessage = (event: MessageEvent<Float32Array>) => {
		field?.applyPhysics(event.data);
		if (soundscape) for (const speed of landings.detect(event.data, PHYSICS_STEP)) soundscape.impact(speed);
	};
	const stopCollapse = () => {
		physicsWorker.postMessage({ type: 'stop' });
		landings.reset();
		field?.stopPhysics();
		patch({ collapsed: false });
	};
	let inspecting: number | null = null;
	const blocksVisible = () => !!field && (!field.settled || field.sectioned || field.building);
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
		updateEra();
		gsap.updateRoot(time / 1000);
		const showBlocks = blocksVisible();
		targetVolume.visible = !showBlocks;
		if (field) {
			field.mesh.visible = showBlocks;
			updateInterior(showBlocks);
			if (showBlocks) {
				updateInspector();
				field.step(renderer, dt);
			}
		}
		environment.update(director.t);
		terrain.updateSun(environment.sunDirection);
		hotspots.update(camera, canvas.clientWidth, canvas.clientHeight, director.isFree && !director.droneFlying, time);
		updateAtmosphere(dt);
		updateTown(dt);
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
					gpuMs: Math.round(((stats as { totalGpuDuration?: number } | null)?.totalGpuDuration ?? 0) * 10) / 10,
					computeMs:
						Math.round(((stats as { totalGpuDurationCompute?: number } | null)?.totalGpuDurationCompute ?? 0) * 10) /
						10,
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
		if (!looping || !field || !blocksVisible()) return undefined;
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
		if (index === undefined) {
			const chosen = director.isFree ? pyramidAt(event) : null;
			if (chosen) void setTarget(chosen);
			return;
		}
		if (!field) return;
		field.selected.value = index ?? NO_BLOCK;
		patch({ selected: index === null ? null : field.info(index) });
	};
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointerup', onPointerUp);

	gsap.ticker.remove(gsap.updateRoot);
	await buildField(tier, 0.2);
	renderer.setAnimationLoop(frame);
	looping = true;
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
			height: SPHINX_PLACEMENT.height,
			renderScale: SPHINX_PLACEMENT.renderScale
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

	let switching = false;
	const resetTools = () => {
		if (!field) return;
		stopCollapse();
		inspecting = null;
		field.inspected.value = NO_BLOCK;
		scale.visible = false;
		field.setDeconstructed(false);
		field.setXray(null);
		field.section.value = 0;
		buildProgress = null;
		updateRamps();
		dressing.casing.visible = false;
		patch({
			blockMode: 'assembled',
			inspecting: null,
			selected: null,
			hovered: null,
			xray: null,
			build: null,
			origins: false
		});
	};
	const focusTarget = (seconds: number) => {
		const { x, y, z } = targetVolume.position;
		const away = new Vector3(camera.position.x - x, 0, camera.position.z - z);
		if (away.lengthSq() < 1) away.set(1, 0, 1);
		away.normalize().multiplyScalar(target.baseSide * TARGET_VIEW_DISTANCE);
		director.focus(
			[x + away.x, y + target.originalHeight * TARGET_VIEW_HEIGHT, z + away.z],
			[x, y + target.originalHeight * 0.3, z],
			seconds
		);
	};
	const setTarget = async (id: BlockTargetId) => {
		if (id === target.id || switching) return;
		switching = true;
		patch({ switchingTarget: true });
		resetTools();
		targetVolume.visible = true;
		undressTarget(dressing);
		target = BLOCK_TARGETS[id];
		targetVolume = volumeOf(id);
		courseTops = courseTopsOf(target.courses);
		courseVolumes = cumulativeCourseVolume(target.courses, target.baseSide, target.originalHeight);
		dressing = dressTarget();
		try {
			await buildField(tier, 1);
			if (director.isFree) focusTarget(reducedMotion ? 0 : TARGET_FLIGHT_SECONDS);
		} finally {
			switching = false;
			patch({ target: id, switchingTarget: false, status: 'ready', progress: 1, step: 'Ready' });
		}
	};
	const pyramidAt = (event: PointerEvent): BlockTargetId | null => {
		const rect = canvas.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		ray.setFromCamera(pointer, camera);
		const candidates = BLOCK_TARGET_IDS.map((candidate) => volumeOf(candidate));
		const [hit] = ray.intersectObjects(candidates, true);
		let object: Object3D | null = hit?.object ?? null;
		while (object && !isBlockTargetId(object.name)) object = object.parent;
		return object && isBlockTargetId(object.name) ? object.name : null;
	};
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
			dressing.jointDust.trigger(renderer);
			soundscape?.rumble(ANTICIPATION_SECONDS + 1.6);
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
		setBuild: (progress) => {
			buildProgress = progress;
			updateRamps();
			patch({ build: progress });
		},
		setRamp: (next) => {
			ramp = next;
			updateRamps();
			patch({ ramp: next });
		},
		setTarget,
		focusHotspot: (id) => {
			activeHotspot = id;
			controls.minDistance = id === 'daily-life' ? 3 : 40;
			const flight = id === null ? null : hotspots.flight(id, camera.position);
			if (flight) director.focus(flight.camera.toArray(), flight.anchor.toArray(), reducedMotion ? 0 : flight.seconds);
			patch({ hotspot: flight ? id : null });
		},
		startDrone: () => {
			const khafre = pyramidObjects[placedPyramids.findIndex((placed) => placed.id === 'khafre')];
			const center = khufuVolume.position
				.clone()
				.lerp(khafre?.position ?? khufuVolume.position, DRONE_CENTER_TOWARD_KHAFRE);
			director.startDrone(
				[center.x, khufuVolume.position.y, center.z],
				matchMedia('(prefers-reduced-motion: reduce)').matches
			);
		},
		setSound: (enabled) => {
			if (enabled && !soundscape) soundscape = new Soundscape();
			if (!enabled && soundscape) {
				soundscape.dispose();
				soundscape = null;
			}
			patch({ sound: enabled });
		},
		setOrigins: (enabled) => {
			if (field) field.section.value = enabled ? 1 : 0;
			dressing.casing.visible = enabled;
			patch({ origins: enabled });
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
			landings.reset();
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
			disposeRockField(quarryBlocks);
			quarryBedrockBlocks.geometry.dispose();
			disposeComplex(complex);
			valley.dispose();
			reconstruction.dispose();
			for (const material of Object.values(ruinMaterials)) material.dispose();
			workersTown.dispose();
			dailyLife.dispose();
			mudbrick.dispose();
			for (const object of pyramidObjects) {
				object.traverse((child) => {
					if ((child as Mesh).isMesh) (child as Mesh).geometry.dispose();
				});
			}
			masonry.dispose();
			undressTarget(dressing);
			hotspots.dispose();
			soundscape?.dispose();
			torches.dispose();
			motes.dispose();
			dustDevils?.dispose();
			if (birds) disposeBirds(birds);
			(interior.children[0] as Mesh | undefined)?.geometry.dispose();
			for (const material of Object.values(interiorMaterials)) material.dispose();
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
