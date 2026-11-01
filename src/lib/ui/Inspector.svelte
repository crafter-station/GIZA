<script lang="ts">
import { Button } from 'bits-ui';
import type { BlockInfo } from '../app/state.ts';

interface Props {
	block: BlockInfo;
	onclose: () => void;
}

let { block, onclose }: Props = $props();
const format = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const volume = $derived(block.size[0] * block.size[1] * block.size[2]);
</script>

<section
	class="papyrus fixed top-20 left-4 max-h-[calc(100svh-11.5rem)] w-80 overflow-y-auto overscroll-contain sm:left-6 rounded-sm border border-gold/70 shadow-[0_18px_40px_-18px_rgb(42_31_20/0.7)]"
	aria-label="Block inspector"
	data-lenis-prevent
>
	<div class="frieze h-[7px]" aria-hidden="true"></div>
	<div class="p-5">
		<p class="text-[10px] font-semibold tracking-[0.28em] text-ochre uppercase">Inspector</p>
		<h2 class="mt-1 font-display text-2xl leading-none font-semibold">
			{block.kind === 'core' ? 'Core superblock' : `Block from course ${block.course}`}
		</h2>
		<p class="mt-2 text-xs leading-relaxed text-ink/70">
			Shown at true scale beside a 1.75 m figure. Dimensions follow the measured course height; the block length is a
			visual subdivision of the course.
		</p>
		<dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-ink/60">Size</dt>
			<dd class="font-medium tabular-nums">
				{format(block.size[0])}
				× {format(block.size[1])} × {format(block.size[2])} m
			</dd>
			<dt class="text-ink/60">Volume</dt>
			<dd class="font-medium tabular-nums">≈ {format(volume)} m³</dd>
			{#if block.kind === 'core'}
				<dt class="text-ink/60">Stands for</dt>
				<dd class="font-medium">≈ {format(block.represents, 0)} real blocks</dd>
			{/if}
			<dt class="text-ink/60">Stone</dt>
			<dd class="font-medium">Local limestone from the plateau</dd>
		</dl>
		<figure class="register mt-4 pt-3">
			<svg viewBox="0 0 200 120" class="w-full" role="img" aria-label="Route from the quarry south of the pyramid">
				<rect x="70" y="10" width="60" height="60" fill="none" stroke="var(--color-ink)" stroke-width="1.5" />
				<path d="M70 10 L130 70 M130 10 L70 70" stroke="var(--color-ink)" stroke-opacity="0.35" />
				<ellipse
					cx="110"
					cy="102"
					rx="40"
					ry="12"
					fill="var(--color-ochre)"
					fill-opacity="0.25"
					stroke="var(--color-ochre)"
					stroke-dasharray="3 3"
				/>
				<path
					d="M110 92 C108 84 104 78 100 72"
					stroke="var(--color-lapis)"
					stroke-width="2"
					fill="none"
					marker-end="url(#arrow)"
				/>
				<defs>
					<marker id="arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
						<path d="M0 0 L6 3 L0 6 Z" fill="var(--color-lapis)" />
					</marker>
				</defs>
				<text x="100" y="44" text-anchor="middle" font-size="9" fill="var(--color-ink)">Khufu</text>
				<text x="156" y="105" font-size="8" fill="var(--color-ochre)">Quarry</text>
			</svg>
			<figcaption class="mt-1 text-[10px] text-ink/60">
				Schematic: the core blocks came from quarries on the plateau south of the pyramid.
			</figcaption>
		</figure>
		<Button.Root
			class="mt-3 w-full rounded-sm border border-ink/35 px-3 py-1.5 text-xs font-semibold tracking-wide hover:bg-papyrus-deep"
			onclick={onclose}
		>
			Return the block
		</Button.Root>
	</div>
</section>
