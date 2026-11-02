<script lang="ts">
import Icon from '@iconify/svelte';
import github from '@iconify-icons/akar-icons/github';
import { onMount, untrack } from 'svelte';
import { parseFlags } from '#lib/app/flags.ts';
import {
	createStructuredData,
	OG_IMAGE_ALT,
	OG_IMAGE_HEIGHT,
	OG_IMAGE_PATH,
	OG_IMAGE_WIDTH,
	SITE_DESCRIPTION,
	SITE_LOCALE,
	SITE_NAME,
	SITE_TITLE,
	siteUrl
} from '#lib/app/site.ts';
import { engineState, tourState } from '#lib/app/state.ts';
import { BLOCK_TARGETS } from '#lib/data/block-targets.ts';
import { KHAFRE, KHUFU, MENKAURE } from '#lib/data/pyramids.ts';
import type { Engine } from '#lib/engine/engine.ts';
import { CHAPTERS } from '#lib/tour/chapters.ts';
import BlockPanel from '#lib/ui/BlockPanel.svelte';
import HotspotLayer from '#lib/ui/HotspotLayer.svelte';
import Inspector from '#lib/ui/Inspector.svelte';
import LightingControls from '#lib/ui/LightingControls.svelte';
import Loader from '#lib/ui/Loader.svelte';
import ScrollHint from '#lib/ui/ScrollHint.svelte';
import SoundToggle from '#lib/ui/SoundToggle.svelte';
import TourChapters from '#lib/ui/TourChapters.svelte';
import TourNav from '#lib/ui/TourNav.svelte';
import type { LightingMode } from '#lib/world/atmosphere/lighting.ts';
import { goto } from '$app/navigation';

let canvas: HTMLCanvasElement;
let engine = $state<Engine | null>(null);
let lighting = $state<LightingMode>('tour');

const canonical = siteUrl('/');
const ogImage = siteUrl(OG_IMAGE_PATH);
const jsonLd = JSON.stringify(createStructuredData()).replaceAll('<', '\\u003c');

const pyramids = [
	{ name: 'Khufu', height: KHUFU.originalHeight.value, base: `${KHUFU.baseSide.value} m` },
	{ name: 'Khafre', height: KHAFRE.originalHeight.value, base: `${KHAFRE.baseSide.value} m` },
	{
		name: 'Menkaure',
		height: MENKAURE.originalHeight.value,
		base: `${MENKAURE.base.value.a} × ${MENKAURE.base.value.b} m`
	}
];

const ready = $derived(engine !== null && $engineState.status === 'ready');
const chapter = $derived(CHAPTERS[$tourState.chapter]);
const mode = $derived($tourState.mode);
const showBlockPanel = $derived(mode === 'free' ? !$tourState.drone : chapter.blockActions);

$effect(() => {
	if (mode === 'tour' && $engineState.hotspot !== null) engine?.focusHotspot(null);
});

$effect(() => {
	if (ready && mode === 'tour' && $engineState.target !== 'khufu' && !$engineState.switchingTarget)
		void engine?.setTarget('khufu');
});
const SCROLL_HINT_SPAN = 0.15;
let tourEntryT = $state<number | null>(null);
const showScrollHint = $derived(
	ready &&
		mode === 'tour' &&
		tourEntryT !== null &&
		Math.abs($tourState.t - tourEntryT) < SCROLL_HINT_SPAN &&
		$tourState.chapter < CHAPTERS.length - 1
);

$effect(() => {
	tourEntryT = mode === 'tour' ? untrack(() => $tourState.t) : null;
});

$effect(() => {
	if (!ready || $tourState.mode === 'free') return;
	const hash = `#${chapter.id}`;
	if (location.hash !== hash) void goto(hash, { state: {}, shallow: true, replace: true });
});

$effect(() => {
	if (!showBlockPanel && $engineState.blockMode === 'deconstructed') engine?.reassemble();
});

function goTo(index: number) {
	engine?.goToChapter(index);
}

function toggleFree() {
	if (!engine) return;
	if ($tourState.mode === 'free') engine.exitFree();
	else engine.enterFree();
}

onMount(() => {
	lighting = parseFlags(location.search).lighting;
	let disposed = false;
	let started: Engine | null = null;
	import('#lib/engine/engine.ts')
		.then(({ startEngine }) => startEngine(canvas, parseFlags(location.search)))
		.then((instance) => {
			started = instance;
			if (disposed) {
				instance.dispose();
				return;
			}
			engine = instance;
			const linked = CHAPTERS.findIndex((item) => `#${item.id}` === location.hash);
			const flags = parseFlags(location.search);
			if (linked > 0) instance.goToChapter(linked);
			else if (flags.t === null && flags.cam === null) instance.startDrone();
		})
		.catch((error: unknown) => {
			document.documentElement.dataset.engine = 'error';
			engineState.update((state) => ({
				...state,
				status: 'error',
				error: error instanceof Error ? error.message : String(error)
			}));
		});

	const onKeyDown = (event: KeyboardEvent) => {
		if (
			!engine ||
			event.defaultPrevented ||
			(event.target instanceof Element &&
				event.target.closest(
					'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], [role="dialog"]'
				))
		)
			return;
		if (event.key === 'ArrowRight' && $tourState.mode === 'tour') goTo($tourState.chapter + 1);
		else if (event.key === 'ArrowLeft' && $tourState.mode === 'tour') goTo($tourState.chapter - 1);
		else if (event.key === 'Escape') {
			if ($engineState.selected) engine.clearSelection();
			else if ($engineState.blockMode === 'deconstructed') engine.reassemble();
			else if ($tourState.mode === 'free') engine.exitFree();
		}
	};
	const onHashChange = () => {
		const linked = CHAPTERS.findIndex((item) => `#${item.id}` === location.hash);
		if (engine && linked >= 0 && linked !== $tourState.chapter) engine.goToChapter(linked);
	};
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('hashchange', onHashChange);

	return () => {
		disposed = true;
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('hashchange', onHashChange);
		started?.dispose();
	};
});
</script>

<svelte:head>
	<title>{SITE_TITLE}</title>
	<meta name="description" content={SITE_DESCRIPTION}>
	<meta name="robots" content="max-image-preview:large">
	<link rel="canonical" href={canonical}>
	<meta property="og:type" content="website">
	<meta property="og:site_name" content={SITE_NAME}>
	<meta property="og:title" content={SITE_TITLE}>
	<meta property="og:description" content={SITE_DESCRIPTION}>
	<meta property="og:url" content={canonical}>
	<meta property="og:image" content={ogImage}>
	<meta property="og:image:width" content={String(OG_IMAGE_WIDTH)}>
	<meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)}>
	<meta property="og:image:alt" content={OG_IMAGE_ALT}>
	<meta property="og:locale" content={SITE_LOCALE}>
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:title" content={SITE_TITLE}>
	<meta name="twitter:description" content={SITE_DESCRIPTION}>
	<meta name="twitter:image" content={ogImage}>
	<meta name="twitter:image:alt" content={OG_IMAGE_ALT}>
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<canvas
	bind:this={canvas}
	class="fixed inset-0 h-svh w-full touch-none outline-none"
	aria-label="3D view of the Giza Plateau. In free exploration, drag to orbit, right-drag or two fingers to move over the ground, scroll to move towards the pointer, and use the arrow keys after clicking the scene."
	tabindex="0"
></canvas>

<div class="pointer-events-none" style:height="{CHAPTERS.length * 120}svh" aria-hidden="true"></div>

{#if $engineState.status === 'error'}
	<main class="papyrus fixed inset-0 overflow-auto p-8">
		<div class="mx-auto flex max-w-3xl flex-col gap-6">
			<h1 class="font-display text-5xl font-semibold">Giza</h1>
			<p class="text-lg" role="alert">The 3D view could not start: {$engineState.error}</p>
			<ul class="grid gap-2" data-testid="pyramid-list">
				{#each pyramids as pyramid (pyramid.name)}
					<li><strong>{pyramid.name}</strong> - {pyramid.height} m tall originally, base {pyramid.base}</li>
				{/each}
			</ul>
		</div>
	</main>
{:else}
	<LightingControls
		value={lighting}
		disabled={!ready}
		onchange={(mode) => {
			lighting = mode;
			engine?.setLighting(mode);
		}}
	>
		<a
			href="https://github.com/crafter-station/GIZA"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="View Giza source code on GitHub"
			title="View source code on GitHub"
			class="flex size-11 items-center justify-center rounded-sm border border-gold/60 bg-lapis-deep/85 text-gold-light shadow-lg backdrop-blur-sm outline-none transition hover:bg-lapis focus-visible:ring-2 focus-visible:ring-gold-light"
		>
			<Icon icon={github} class="size-5" aria-hidden="true" />
			<span class="sr-only">GitHub repository</span>
		</a>
		<SoundToggle pressed={$engineState.sound} disabled={!ready} onchange={(enabled) => engine?.setSound(enabled)} />
	</LightingControls>
	<header
		class="pointer-events-none fixed top-4 left-4 flex items-center gap-3 rounded-sm border border-gold/60 bg-lapis-deep/85 py-2 pr-4 pl-3 text-papyrus shadow-lg backdrop-blur-sm"
	>
		<img
			src="/images/pyramid-sign.webp"
			alt=""
			aria-hidden="true"
			class="h-7 w-11 shrink-0 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)] sm:h-8 sm:w-14"
		>
		<div>
			<h1 class="font-display text-2xl leading-none font-semibold tracking-wide">Giza</h1>
			<p class="mt-0.5 hidden text-[10px] tracking-[0.25em] text-gold-light/90 uppercase sm:block">
				The pyramids, block by block
			</p>
		</div>
	</header>
	{#if !$engineState.inspecting}
		<TourChapters tour={$tourState} />
	{/if}
	{#if showBlockPanel}
		<BlockPanel
			state={$engineState}
			ondeconstruct={() => engine?.deconstruct()}
			onreassemble={() => engine?.reassemble()}
			onxray={(course) => engine?.setXray(course)}
			onforcefield={(enabled) => engine?.setForceField(enabled)}
			oninspect={(index) => engine?.inspect(index)}
			oncollapse={() => void engine?.collapse()}
			onbuild={(progress) => engine?.setBuild(progress)}
			onramp={(ramp) => engine?.setRamp(ramp)}
			onorigins={(enabled) => engine?.setOrigins(enabled)}
			ontarget={(id) => void engine?.setTarget(id)}
			canChooseTarget={mode === 'free'}
		/>
	{/if}
	{#if $engineState.inspecting}
		<Inspector
			block={$engineState.inspecting}
			target={BLOCK_TARGETS[$engineState.target]}
			onclose={() => engine?.inspect(null)}
		/>
	{/if}
	{#if mode === 'free' && !$tourState.drone}
		<HotspotLayer active={$engineState.hotspot} disabled={!ready} onfocus={(id) => engine?.focusHotspot(id)} />
	{/if}
	<TourNav tour={$tourState} disabled={!ready} ongo={goTo} ontogglefree={toggleFree} />
	{#if showScrollHint}
		<ScrollHint />
	{/if}
	{#if $engineState.status === 'loading'}
		<Loader progress={$engineState.progress} step={$engineState.step} />
	{/if}
{/if}
