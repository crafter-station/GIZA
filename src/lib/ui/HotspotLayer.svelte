<script lang="ts">
import Icon from '@iconify/svelte';
import chevronLeft from '@iconify-icons/lucide/chevron-left';
import chevronRight from '@iconify-icons/lucide/chevron-right';
import mapPin from '@iconify-icons/lucide/map-pin';
import close from '@iconify-icons/lucide/x';
import { Button, Popover } from 'bits-ui';
import { hotspotMarkers } from '../app/state.ts';
import { SOURCES } from '../content/sources.ts';
import { HOTSPOTS, hotspotById } from '../data/hotspots.ts';

interface Props {
	active: string | null;
	disabled: boolean;
	onfocus: (id: string | null) => void;
}

let { active, disabled, onfocus }: Props = $props();
let listOpen = $state(false);
const index = $derived(active === null ? -1 : HOTSPOTS.findIndex((hotspot) => hotspot.id === active));
const current = $derived(index >= 0 ? HOTSPOTS[index] : null);

function step(delta: number) {
	const next = HOTSPOTS[(index + delta + HOTSPOTS.length) % HOTSPOTS.length];
	onfocus(next.id);
}

function choose(id: string) {
	listOpen = false;
	onfocus(id);
}
</script>

<div class="pointer-events-none fixed inset-0 z-10" aria-hidden={disabled}>
	{#each $hotspotMarkers as marker (marker.id)}
		<Button.Root
			class="pointer-events-auto absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-display text-sm font-semibold shadow-[0_2px_10px_rgb(20_14_8/0.55)] transition-[opacity,transform,background-color] hover:scale-110 focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none {marker.id ===
			active
				? 'scale-110 border-papyrus bg-gold text-ink'
				: 'border-gold bg-lapis-deep/85 text-papyrus'} {marker.occluded && marker.id !== active ? 'opacity-35' : ''}"
			style="left: {marker.x}px; top: {marker.y}px"
			{disabled}
			aria-label="{marker.number}. {hotspotById(marker.id)?.text.value.title}"
			onclick={() => onfocus(marker.id)}
		>
			{marker.number}
		</Button.Root>
	{/each}
</div>

{#if current}
	<section
		class="papyrus custom-scrollbar touch-pan-y fixed bottom-24 left-4 z-20 max-h-[calc(100svh-8rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-sm border border-gold/70 shadow-[0_18px_40px_-18px_rgb(42_31_20/0.7)] sm:bottom-6"
		aria-label="Point of interest"
		aria-live="polite"
		data-lenis-prevent
		data-testid="hotspot-card"
	>
		<div class="frieze h-[7px]" aria-hidden="true"></div>
		<div class="p-4">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-[10px] font-semibold tracking-[0.28em] text-ochre uppercase">
						Point {index + 1} of {HOTSPOTS.length}
					</p>
					<h2 class="mt-1 font-display text-2xl leading-tight font-semibold">{current.text.value.title}</h2>
				</div>
				<Button.Root
					class="grid size-8 shrink-0 place-items-center rounded-sm text-ink/70 transition hover:bg-papyrus-deep"
					aria-label="Close the point of interest"
					onclick={() => onfocus(null)}
				>
					<Icon icon={close} class="size-4" aria-hidden="true" />
				</Button.Root>
			</div>
			<p class="mt-2 text-sm leading-relaxed text-ink/85">{current.text.value.body}</p>
			{#if current.text.status !== 'established'}
				<p class="mt-1 text-[11px] font-semibold text-ochre">Estimate</p>
			{/if}
			<p class="mt-2 text-[11px] leading-snug text-ink/55">
				Sources: {current.text.sources.map((id) => `${SOURCES[id].author}, ${SOURCES[id].year}`).join(' · ')}
			</p>
			<div class="mt-3 flex items-center justify-between">
				<Button.Root
					class="flex items-center gap-1 rounded-sm border border-ink/30 px-2.5 py-1 text-xs font-semibold transition hover:bg-papyrus-deep"
					onclick={() => step(-1)}
				>
					<Icon icon={chevronLeft} class="size-3.5" aria-hidden="true" />
					Previous
				</Button.Root>
				<Button.Root
					class="flex items-center gap-1 rounded-sm border border-gold bg-lapis px-2.5 py-1 text-xs font-semibold text-papyrus transition hover:bg-lapis-deep"
					onclick={() => step(1)}
				>
					Next
					<Icon icon={chevronRight} class="size-3.5" aria-hidden="true" />
				</Button.Root>
			</div>
		</div>
	</section>
{:else}
	<Popover.Root bind:open={listOpen}>
		<Popover.Trigger
			class="fixed bottom-24 left-4 z-20 flex min-h-11 items-center gap-2 rounded-sm border border-gold/60 bg-lapis-deep/85 px-4 py-2 text-sm text-papyrus shadow-lg backdrop-blur-sm transition hover:bg-lapis-deep focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none disabled:opacity-50 sm:bottom-6"
			{disabled}
		>
			<Icon icon={mapPin} class="size-4 text-gold-light" aria-hidden="true" />
			Points of interest
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				side="top"
				align="start"
				sideOffset={8}
				class="papyrus custom-scrollbar touch-pan-y z-50 max-h-[60svh] w-72 overflow-y-auto overscroll-contain rounded-sm border border-gold/70 p-1.5 text-sm shadow-xl"
				data-lenis-prevent
			>
				<ol class="grid gap-0.5">
					{#each HOTSPOTS as hotspot, i (hotspot.id)}
						<li>
							<Button.Root
								class="flex w-full items-center gap-3 rounded-sm px-2.5 py-1.5 text-left transition hover:bg-papyrus-deep focus-visible:bg-papyrus-deep focus-visible:outline-none"
								onclick={() => choose(hotspot.id)}
							>
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full border border-gold bg-lapis-deep font-display text-xs text-papyrus"
									aria-hidden="true"
									>{i + 1}</span
								>
								{hotspot.text.value.title}
							</Button.Root>
						</li>
					{/each}
				</ol>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{/if}
