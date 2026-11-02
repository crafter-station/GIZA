<script lang="ts">
import Icon from '@iconify/svelte';
import menu from '@iconify-icons/lucide/menu';
import x from '@iconify-icons/lucide/x';
import { Button, RadioGroup, Slider, Toggle } from 'bits-ui';
import type { EngineState } from '../app/state.ts';
import { ROYAL_NAMES } from '../content/hieroglyphs.ts';
import {
	BLOCK_TARGET_IDS,
	BLOCK_TARGETS,
	type BlockTargetId,
	isBlockTargetId,
	SCHEMATIC_COURSE
} from '../data/block-targets.ts';
import type { RampId } from '../data/construction.ts';
import ConstructionTools from './ConstructionTools.svelte';
import Cartouche from './egypt/Cartouche.svelte';

interface Props {
	state: EngineState;
	ondeconstruct: () => void;
	onreassemble: () => void;
	onxray: (course: number | null) => void;
	onforcefield: (enabled: boolean) => void;
	oninspect: (index: number | null) => void;
	oncollapse: () => void;
	onbuild: (progress: number | null) => void;
	onramp: (ramp: RampId) => void;
	onorigins: (enabled: boolean) => void;
	ontarget: (id: BlockTargetId) => void;
	canChooseTarget: boolean;
}

let {
	state: engineState,
	ondeconstruct,
	onreassemble,
	onxray,
	onforcefield,
	oninspect,
	oncollapse,
	onbuild,
	onramp,
	onorigins,
	ontarget,
	canChooseTarget
}: Props = $props();
let mobileOpen = $state(false);
const target = $derived(BLOCK_TARGETS[engineState.target]);
const COURSES = $derived(target.courses.length);
const xrayValue = $derived(engineState.xray ?? COURSES);
const block = $derived(engineState.selected ?? engineState.hovered);
const deconstructed = $derived(engineState.blockMode === 'deconstructed');
const format = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const name = $derived(ROYAL_NAMES[engineState.target].value);
</script>

<Button.Root
	class="fixed top-20 right-4 z-30 grid size-11 place-items-center rounded-sm border border-gold/60 bg-lapis-deep/90 text-gold-light shadow-lg backdrop-blur-sm transition hover:bg-lapis focus-visible:ring-2 focus-visible:ring-gold-light sm:hidden"
	aria-label={mobileOpen ? 'Close block controls' : 'Open block controls'}
	aria-controls="block-controls-panel"
	aria-expanded={mobileOpen}
	onclick={() => (mobileOpen = !mobileOpen)}
>
	<Icon icon={mobileOpen ? x : menu} class="size-5" aria-hidden="true" />
</Button.Root>

<aside
	id="block-controls-panel"
	class="papyrus custom-scrollbar touch-pan-y fixed top-32 right-4 left-4 z-20 max-h-[calc(100svh-12rem)] overflow-y-auto overscroll-contain rounded-sm border border-gold/70 shadow-[0_18px_40px_-18px_rgb(42_31_20/0.7)] sm:top-20 sm:left-auto sm:block sm:max-h-[calc(100svh-11.5rem)] sm:w-84 {mobileOpen
		? 'block'
		: 'hidden'}"
	aria-label="Deconstruction controls"
	data-lenis-prevent
>
	<div class="frieze h-[7px]" aria-hidden="true"></div>
	<div class="p-5">
		<div class="flex items-start gap-4">
			<Cartouche glyphs={name.glyphs} name={target.name} transliteration={name.transliteration} />
			<div class="min-w-0">
				<p class="text-[10px] font-semibold tracking-[0.28em] text-ochre uppercase">{target.label}</p>
				<h2 class="mt-1 font-display text-[1.7rem] leading-none font-semibold">{target.name}, block by block</h2>
				<p class="mt-2 text-xs leading-snug text-ink/70">
					<span class="font-display text-lg font-semibold text-ink"
						>≈ {format(target.blockEstimate.value / 1e6, target.blockEstimate.value < 1e6 ? 2 : 1)} million</span
					>
					blocks estimated · {format(engineState.blockCount, 0)} shown: the outer layer block by block, the core in
					superblocks of ≈ {format(engineState.coreRatio, 0)} blocks
				</p>
			</div>
		</div>

		{#if !target.coursesMeasured}
			<p class="mt-2 text-[11px] leading-snug text-ink/60">
				<span class="font-semibold text-ochre">Schematic courses.</span>
				No measured course table of {target.name}
				has been transcribed, so its courses are drawn {format(SCHEMATIC_COURSE.value)} m thick, the mean of Khufu’s;
				the block total is derived from its volume.
			</p>
		{/if}

		<RadioGroup.Root
			class="mt-4 grid grid-cols-3 gap-1.5"
			value={engineState.target}
			disabled={!canChooseTarget || engineState.switchingTarget || engineState.status !== 'ready'}
			onValueChange={(value) => {
				if (isBlockTargetId(value)) ontarget(value);
			}}
			aria-label="Pyramid to take apart"
		>
			{#each BLOCK_TARGET_IDS as id (id)}
				<RadioGroup.Item
					value={id}
					class="flex flex-col items-center gap-1 rounded-sm border border-ink/25 px-1 py-1.5 text-[11px] font-semibold transition hover:bg-papyrus-deep disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-lapis data-[state=checked]:bg-lapis/10 data-[state=checked]:text-lapis"
				>
					<span class="glyph text-base leading-none" aria-hidden="true">{ROYAL_NAMES[id].value.glyphs}</span>
					{BLOCK_TARGETS[id].name}
				</RadioGroup.Item>
			{/each}
		</RadioGroup.Root>
		{#if engineState.switchingTarget}
			<p class="mt-1.5 text-[11px] text-ink/60" aria-live="polite">Cutting the blocks of {target.name}…</p>
		{:else if canChooseTarget}
			<p class="mt-1.5 text-[11px] text-ink/55">You can also click a pyramid in the scene.</p>
		{/if}

		<div class="mt-4 grid grid-cols-2 gap-2">
			<Button.Root
				class="group flex items-center justify-center gap-2 rounded-sm border border-gold bg-lapis px-3 py-2 text-sm font-semibold tracking-wide text-papyrus shadow-[inset_0_1px_0_rgb(232_205_134/0.4)] transition hover:bg-lapis-deep disabled:cursor-not-allowed disabled:opacity-40"
				disabled={engineState.status !== 'ready' || deconstructed}
				onclick={ondeconstruct}
			>
				<img
					src="/images/pyramid-sign.webp"
					alt=""
					aria-hidden="true"
					class="h-5 w-8 shrink-0 object-contain transition group-hover:-translate-y-0.5"
				>
				Deconstruct
			</Button.Root>
			<Button.Root
				class="rounded-sm border border-ink/40 bg-papyrus-deep/50 px-3 py-2 text-sm font-semibold tracking-wide text-ink transition hover:border-ink/70 hover:bg-papyrus-deep disabled:cursor-not-allowed disabled:opacity-40"
				disabled={engineState.status !== 'ready' || !deconstructed}
				onclick={onreassemble}
			>
				Reassemble
			</Button.Root>
		</div>

		{#if block}
			<section
				class="register mt-4 pt-3"
				aria-live="polite"
				aria-label={engineState.selected ? 'Selected block' : 'Block under the pointer'}
			>
				<p class="text-[10px] font-semibold tracking-[0.28em] text-ochre uppercase">
					{engineState.selected ? 'Selected' : 'Pointing at'}
					{block.kind === 'core' ? 'core superblock' : 'block'}
					· No. {format(block.index + 1, 0)}
				</p>
				<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					<dt class="text-ink/60">{block.kind === 'core' ? 'Courses' : 'Course'}</dt>
					<dd class="font-medium">
						{block.kind === 'core' ? `${block.course}–${Math.min(block.course + 9, COURSES)}` : block.course}
						of {COURSES} standing
					</dd>
					{#if block.kind === 'core'}
						<dt class="text-ink/60">Stands for</dt>
						<dd class="font-medium">≈ {format(block.represents, 0)} real blocks</dd>
					{/if}
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

		<section class="register mt-4 grid gap-3 pt-3" aria-label="Tools">
			<div>
				<div class="flex items-center justify-between text-xs">
					<span class="font-semibold tracking-wide">X-ray by course</span>
					<span class="text-ink/65 tabular-nums">
						{engineState.xray === null ? 'Off' : `Courses 1–${engineState.xray} shown`}
					</span>
				</div>
				<Slider.Root
					type="single"
					min={1}
					max={COURSES}
					step={1}
					value={xrayValue}
					disabled={engineState.status !== 'ready'}
					onValueChange={(value) => onxray(value >= COURSES ? null : value)}
					class="relative mt-2 flex h-5 w-full touch-none items-center select-none"
					aria-label="Hide courses above"
				>
					<span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-ink/15">
						<Slider.Range class="absolute h-full bg-ochre" />
					</span>
					<Slider.Thumb
						index={0}
						class="block size-4 rounded-full border-2 border-gold bg-lapis shadow focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none"
					/>
				</Slider.Root>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<Toggle.Root
					class="rounded-sm border border-ink/35 px-3 py-1.5 text-xs font-semibold tracking-wide transition data-[state=on]:border-lapis data-[state=on]:bg-lapis data-[state=on]:text-papyrus disabled:opacity-40"
					disabled={!deconstructed}
					pressed={engineState.forceField}
					onPressedChange={(pressed) => onforcefield(pressed)}
				>
					Force field
				</Toggle.Root>
				<Button.Root
					class="rounded-sm border border-ink/35 px-3 py-1.5 text-xs font-semibold tracking-wide transition hover:bg-papyrus-deep disabled:opacity-40"
					disabled={!deconstructed || !engineState.selected}
					onclick={() => oninspect(engineState.inspecting ? null : (engineState.selected?.index ?? null))}
				>
					{engineState.inspecting ? 'Close inspector' : 'Inspect block'}
				</Button.Root>
			</div>
			<Button.Root
				class="rounded-sm border border-ochre/70 bg-ochre/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-ochre transition hover:bg-ochre/20 disabled:opacity-40"
				disabled={!deconstructed || engineState.collapsed}
				onclick={oncollapse}
			>
				{engineState.collapsed ? 'The top courses have fallen' : 'Collapse the top courses'}
			</Button.Root>
			{#if engineState.forceField}
				<p class="text-[11px] text-ink/65">Drag across the floating blocks to push them aside.</p>
			{/if}
		</section>

		<ConstructionTools state={engineState} {onbuild} {onramp} {onorigins} />

		<dl class="mt-3 flex gap-2 text-[10px] tracking-wider text-ink/60 uppercase" data-testid="engine-info">
			<div class="rounded-full border border-ink/15 px-2 py-0.5">
				<dt class="sr-only">Backend</dt>
				<dd>{engineState.backend ?? '-'}</dd>
			</div>
			<div class="rounded-full border border-ink/15 px-2 py-0.5">
				<dt class="sr-only">Quality</dt>
				<dd>{engineState.tier ?? '-'}</dd>
			</div>
		</dl>
	</div>
</aside>
