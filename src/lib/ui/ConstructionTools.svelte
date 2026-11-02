<script lang="ts">
import Icon from '@iconify/svelte';
import chevronDown from '@iconify-icons/lucide/chevron-down';
import pause from '@iconify-icons/lucide/pause';
import play from '@iconify-icons/lucide/play';
import rotateCcw from '@iconify-icons/lucide/rotate-ccw';
import { Button, Select, Slider, Toggle } from 'bits-ui';
import gsap from 'gsap';
import { onDestroy } from 'svelte';
import type { EngineState } from '../app/state.ts';
import {
	BUILD_TIMELINE,
	courseAtProgress,
	cumulativeCourseVolume,
	RAMP_DRAWING,
	RAMP_HYPOTHESES,
	type RampId,
	STONE_ORIGINS
} from '../data/construction.ts';
import { KHUFU_SURVIVING_COURSES_M } from '../data/khufu-courses.ts';
import { KHUFU } from '../data/pyramids.ts';

interface Props {
	state: EngineState;
	onbuild: (progress: number | null) => void;
	onramp: (ramp: RampId) => void;
	onorigins: (enabled: boolean) => void;
}

let { state: engine, onbuild, onramp, onorigins }: Props = $props();

const STEPS = 1000;
const SECONDS_PER_YEAR = 1;
const { years, blocks, workforce } = BUILD_TIMELINE.value;
const cumulative = cumulativeCourseVolume(KHUFU_SURVIVING_COURSES_M, KHUFU.baseSide.value, KHUFU.originalHeight.value);
let standing = 0;
const courseTops = KHUFU_SURVIVING_COURSES_M.map((thickness) => (standing += thickness));

const playhead = { progress: 0 };
let tween: gsap.core.Tween | null = null;
let playing = $state(false);

const progress = $derived(engine.build ?? 0);
const course = $derived(courseAtProgress(cumulative, progress));
const height = $derived(course < 1 ? 0 : courseTops[Math.min(Math.floor(course), courseTops.length) - 1]);
const ramp = $derived(RAMP_HYPOTHESES.find((item) => item.value.id === engine.ramp) ?? RAMP_HYPOTHESES[2]);
const format = (value: number, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

function stop() {
	tween?.kill();
	tween = null;
	playing = false;
}

function toggle() {
	if (playing) {
		stop();
		return;
	}
	playhead.progress = progress >= 1 ? 0 : progress;
	playing = true;
	tween = gsap.to(playhead, {
		progress: 1,
		duration: (1 - playhead.progress) * years * SECONDS_PER_YEAR,
		ease: 'none',
		onUpdate: () => onbuild(playhead.progress),
		onComplete: stop
	});
}

function reset() {
	stop();
	onbuild(null);
}

onDestroy(() => {
	tween?.kill();
	if (engine.build !== null) onbuild(null);
	if (engine.origins) onorigins(false);
});
</script>

<section class="register mt-4 grid gap-3 pt-3" aria-label="Construction">
	<div class="flex items-baseline justify-between">
		<h3 class="font-display text-lg font-semibold">Build it, course by course</h3>
		<span class="rounded-full border border-ochre/50 px-2 py-0.5 text-[10px] tracking-wider text-ochre uppercase"
			>Estimate</span
		>
	</div>

	<div class="flex items-center gap-2">
		<Button.Root
			class="flex size-9 shrink-0 items-center justify-center rounded-sm border border-gold bg-lapis text-papyrus transition hover:bg-lapis-deep disabled:opacity-40"
			disabled={engine.status !== 'ready'}
			aria-label={playing ? 'Pause construction' : 'Play construction'}
			onclick={toggle}
		>
			<Icon icon={playing ? pause : play} class="size-4" aria-hidden="true" />
		</Button.Root>
		<Slider.Root
			type="single"
			min={0}
			max={STEPS}
			step={1}
			value={Math.round(progress * STEPS)}
			disabled={engine.status !== 'ready'}
			onValueChange={(value) => {
				stop();
				onbuild(value / STEPS);
			}}
			class="relative flex h-5 w-full touch-none items-center select-none"
			aria-label="Construction progress"
		>
			<span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-ink/15">
				<Slider.Range class="absolute h-full bg-ochre" />
			</span>
			<Slider.Thumb
				index={0}
				class="block size-4 rounded-full border-2 border-gold bg-lapis shadow focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none"
			/>
		</Slider.Root>
		<Button.Root
			class="flex size-9 shrink-0 items-center justify-center rounded-sm border border-ink/35 transition hover:bg-papyrus-deep disabled:opacity-40"
			disabled={engine.build === null}
			aria-label="Show the finished pyramid"
			onclick={reset}
		>
			<Icon icon={rotateCcw} class="size-4" aria-hidden="true" />
		</Button.Root>
	</div>

	<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" aria-live="off" data-testid="build-counters">
		<dt class="text-ink/60">Year of Khufu</dt>
		<dd class="font-medium tabular-nums">≈ {format(Math.max(1, Math.ceil(progress * years)))} of {years}</dd>
		<dt class="text-ink/60">Blocks laid</dt>
		<dd class="font-medium tabular-nums">≈ {format(progress * blocks)}</dd>
		<dt class="text-ink/60">Courses</dt>
		<dd class="font-medium tabular-nums">{format(Math.floor(course))} · {format(height, 1)} m</dd>
		<dt class="text-ink/60">Workforce</dt>
		<dd class="font-medium tabular-nums">{format(workforce.min)}–{format(workforce.max)}</dd>
	</dl>
	<p class="text-[11px] leading-snug text-ink/60">{BUILD_TIMELINE.note}</p>

	<div>
		<Select.Root
			type="single"
			value={engine.ramp ?? 'spiral'}
			disabled={engine.status !== 'ready'}
			onValueChange={(next) => {
				const match = RAMP_HYPOTHESES.find((item) => item.value.id === next);
				if (match) onramp(match.value.id);
			}}
		>
			<Select.Trigger
				aria-label="Ramp hypothesis"
				class="flex min-h-10 w-full items-center justify-between gap-3 rounded-sm border border-ink/35 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold-light disabled:opacity-50"
			>
				<span><span class="text-ink/60">Ramp:</span> <span class="font-medium">{ramp.value.name}</span></span>
				<Icon icon={chevronDown} class="size-3 shrink-0 text-ochre" aria-hidden="true" />
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					sideOffset={6}
					class="papyrus z-50 min-w-(--bits-select-anchor-width) overflow-hidden rounded-sm border border-gold/70 p-1.5 text-sm shadow-xl"
				>
					<Select.Viewport>
						{#each RAMP_HYPOTHESES as item (item.value.id)}
							<Select.Item
								value={item.value.id}
								label={item.value.name}
								class="flex min-h-10 cursor-pointer items-center rounded-sm px-3 outline-none data-highlighted:bg-papyrus-deep data-selected:font-semibold data-selected:text-lapis"
							>
								{item.value.name}
							</Select.Item>
						{/each}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
		<p class="mt-1.5 text-xs leading-snug text-ink/70">
			<span class="font-semibold text-ochre">Hypothesis.</span>
			{ramp.value.summary}
		</p>
		<p class="mt-1 text-[11px] leading-snug text-ink/55">{RAMP_DRAWING.note}</p>
	</div>
</section>

<section class="register mt-4 grid gap-2 pt-3" aria-label="Stone origins">
	<Toggle.Root
		class="rounded-sm border border-ink/35 px-3 py-1.5 text-xs font-semibold tracking-wide transition data-[state=on]:border-lapis data-[state=on]:bg-lapis data-[state=on]:text-papyrus disabled:opacity-40"
		disabled={engine.status !== 'ready'}
		pressed={engine.origins}
		onPressedChange={(pressed) => onorigins(pressed)}
	>
		{engine.origins ? 'Hide where the stone came from' : 'Show where the stone came from'}
	</Toggle.Root>
	{#if engine.origins}
		<ul class="grid gap-2 text-xs leading-snug" data-testid="stone-legend">
			{#each STONE_ORIGINS as origin (origin.value.id)}
				<li class="flex gap-2.5">
					<span
						class="mt-0.5 size-3.5 shrink-0 rounded-[2px] border border-ink/30"
						style:background-color={hex(origin.value.color)}
						aria-hidden="true"
					></span>
					<span><span class="font-semibold">{origin.value.name}.</span> {origin.value.use}</span>
				</li>
			{/each}
		</ul>
		<p class="text-[11px] leading-snug text-ink/55">
			The east half is cut away to show the granite chambers; the pale shell marks the original Tura casing.
		</p>
	{/if}
</section>
