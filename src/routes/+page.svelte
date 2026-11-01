<script lang="ts">
import { onMount } from 'svelte';
import { parseFlags } from '#lib/app/flags.ts';
import { engineState, tourState } from '#lib/app/state.ts';
import { PYRAMID_SIGN } from '#lib/content/hieroglyphs.ts';
import { KHAFRE, KHUFU, MENKAURE } from '#lib/data/pyramids.ts';
import type { Engine } from '#lib/engine/engine.ts';
import { CHAPTERS } from '#lib/tour/chapters.ts';
import BlockPanel from '#lib/ui/BlockPanel.svelte';
import LightingControls from '#lib/ui/LightingControls.svelte';
import Loader from '#lib/ui/Loader.svelte';
import TourChapters from '#lib/ui/TourChapters.svelte';
import TourNav from '#lib/ui/TourNav.svelte';
import type { LightingMode } from '#lib/world/atmosphere/lighting.ts';
import { goto } from '$app/navigation';

let canvas: HTMLCanvasElement;
let engine = $state<Engine | null>(null);
let lighting = $state<LightingMode>('tour');

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
const showBlockPanel = $derived($tourState.mode === 'free' || chapter.blockActions);

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
			if (linked > 0) instance.goToChapter(linked);
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
	window.addEventListener('keydown', onKeyDown);

	return () => {
		disposed = true;
		window.removeEventListener('keydown', onKeyDown);
		started?.dispose();
	};
});
</script>

<svelte:head>
	<title>Giza — The Pyramids in 3D</title>
	<meta name="description" content="An educational 3D journey through the pyramids of Giza.">
</svelte:head>

<canvas
	bind:this={canvas}
	class="fixed inset-0 h-svh w-full touch-none"
	aria-label="3D view of the Giza Plateau"
></canvas>

<div class="pointer-events-none" style:height="{CHAPTERS.length * 120}svh" aria-hidden="true"></div>

{#if $engineState.status === 'error'}
	<main class="papyrus fixed inset-0 overflow-auto p-8">
		<div class="mx-auto flex max-w-3xl flex-col gap-6">
			<h1 class="font-display text-5xl font-semibold">Giza</h1>
			<p class="text-lg" role="alert">The 3D view could not start: {$engineState.error}</p>
			<ul class="grid gap-2" data-testid="pyramid-list">
				{#each pyramids as pyramid (pyramid.name)}
					<li><strong>{pyramid.name}</strong> — {pyramid.height} m tall originally, base {pyramid.base}</li>
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
	/>
	<header
		class="pointer-events-none fixed top-4 left-4 flex items-center gap-3 rounded-sm border border-gold/60 bg-lapis-deep/85 py-2 pr-4 pl-3 text-papyrus shadow-lg backdrop-blur-sm"
	>
		<span class="glyph text-2xl text-gold-light" aria-hidden="true">{PYRAMID_SIGN}</span>
		<div>
			<h1 class="font-display text-2xl leading-none font-semibold tracking-wide">Giza</h1>
			<p class="mt-0.5 text-[10px] tracking-[0.25em] text-gold-light/90 uppercase">The pyramids, block by block</p>
		</div>
	</header>
	<TourChapters tour={$tourState} />
	{#if showBlockPanel}
		<BlockPanel
			state={$engineState}
			ondeconstruct={() => engine?.deconstruct()}
			onreassemble={() => engine?.reassemble()}
		/>
	{/if}
	<TourNav tour={$tourState} disabled={!ready} ongo={goTo} ontogglefree={toggleFree} />
	{#if $engineState.status === 'loading'}
		<Loader progress={$engineState.progress} step={$engineState.step} />
	{/if}
{/if}
