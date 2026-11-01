<script lang="ts">
import { Button } from 'bits-ui';
import type { EngineState } from '../app/state.ts';
import { PYRAMID_SIGN, ROYAL_NAMES } from '../content/hieroglyphs.ts';
import { KHUFU } from '../data/pyramids.ts';
import Cartouche from './egypt/Cartouche.svelte';

interface Props {
	state: EngineState;
	ondeconstruct: () => void;
	onreassemble: () => void;
}

let { state, ondeconstruct, onreassemble }: Props = $props();
const block = $derived(state.selected ?? state.hovered);
const deconstructed = $derived(state.blockMode === 'deconstructed');
const format = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const name = ROYAL_NAMES.khufu.value;
</script>

<aside
	class="papyrus fixed top-20 right-4 left-4 overflow-hidden rounded-sm border border-gold/70 shadow-[0_18px_40px_-18px_rgb(42_31_20/0.7)] sm:left-auto sm:w-84"
	aria-label="Deconstruction controls"
>
	<div class="frieze h-[7px]" aria-hidden="true"></div>
	<div class="p-5">
		<div class="flex items-start gap-4">
			<Cartouche glyphs={name.glyphs} name="Khufu" transliteration={name.transliteration} />
			<div class="min-w-0">
				<p class="text-[10px] font-semibold tracking-[0.28em] text-ochre uppercase">Great Pyramid · G1</p>
				<h2 class="mt-1 font-display text-[1.7rem] leading-none font-semibold">Khufu, block by block</h2>
				<p class="mt-2 text-xs leading-snug text-ink/70">
					<span class="font-display text-lg font-semibold text-ink"
						>≈ {format(KHUFU.blockCount.value / 1e6, 1)} million</span
					>
					blocks estimated · {format(state.blockCount, 0)} shown (outer layer)
				</p>
			</div>
		</div>

		<div class="mt-4 grid grid-cols-2 gap-2">
			<Button.Root
				class="group flex items-center justify-center gap-2 rounded-sm border border-gold bg-lapis px-3 py-2 text-sm font-semibold tracking-wide text-papyrus shadow-[inset_0_1px_0_rgb(232_205_134/0.4)] transition hover:bg-lapis-deep disabled:cursor-not-allowed disabled:opacity-40"
				disabled={state.status !== 'ready' || deconstructed}
				onclick={ondeconstruct}
			>
				<span class="glyph text-base text-gold-light transition group-hover:-translate-y-0.5" aria-hidden="true"
					>{PYRAMID_SIGN}</span
				>
				Deconstruct
			</Button.Root>
			<Button.Root
				class="rounded-sm border border-ink/40 bg-papyrus-deep/50 px-3 py-2 text-sm font-semibold tracking-wide text-ink transition hover:border-ink/70 hover:bg-papyrus-deep disabled:cursor-not-allowed disabled:opacity-40"
				disabled={state.status !== 'ready' || !deconstructed}
				onclick={onreassemble}
			>
				Reassemble
			</Button.Root>
		</div>

		{#if block}
			<section
				class="register mt-4 pt-3"
				aria-live="polite"
				aria-label={state.selected ? 'Selected block' : 'Block under the pointer'}
			>
				<p class="text-[10px] font-semibold tracking-[0.28em] text-ochre uppercase">
					{state.selected ? 'Selected block' : 'Block'}
					· No. {format(block.index + 1, 0)}
				</p>
				<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					<dt class="text-ink/60">Course</dt>
					<dd class="font-medium">{block.course} of {KHUFU.courses.value}</dd>
					<dt class="text-ink/60">Size</dt>
					<dd class="font-medium tabular-nums">
						{format(block.size[0])}
						× {format(block.size[1])} × {format(block.size[2])} m
					</dd>
					<dt class="text-ink/60">Volume</dt>
					<dd class="font-medium tabular-nums">≈ {format(block.size[0] * block.size[1] * block.size[2])} m³</dd>
				</dl>
			</section>
		{:else}
			<p class="register mt-4 pt-3 text-xs leading-relaxed text-ink/65">
				{deconstructed
					? 'Point at a floating block to read it; click to keep it selected.'
					: 'Take the pyramid apart to inspect its blocks one by one.'}
			</p>
		{/if}

		<dl class="mt-3 flex gap-2 text-[10px] tracking-wider text-ink/60 uppercase" data-testid="engine-info">
			<div class="rounded-full border border-ink/15 px-2 py-0.5">
				<dt class="sr-only">Backend</dt>
				<dd>{state.backend ?? '—'}</dd>
			</div>
			<div class="rounded-full border border-ink/15 px-2 py-0.5">
				<dt class="sr-only">Quality</dt>
				<dd>{state.tier ?? '—'}</dd>
			</div>
		</dl>
	</div>
</aside>
