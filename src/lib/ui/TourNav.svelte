<script lang="ts">
import Icon from '@iconify/svelte';
import arrowLeft from '@iconify-icons/lucide/arrow-left';
import arrowRight from '@iconify-icons/lucide/arrow-right';
import chevronDown from '@iconify-icons/lucide/chevron-down';
import { Button, Select, Toggle } from 'bits-ui';
import type { TourState } from '../app/state.ts';
import { egyptianNumeral } from '../content/hieroglyphs.ts';
import { CHAPTERS } from '../tour/chapters.ts';

interface Props {
	tour: TourState;
	disabled: boolean;
	ongo: (index: number) => void;
	ontogglefree: () => void;
}

let { tour, disabled, ongo, ontogglefree }: Props = $props();
const free = $derived(tour.mode === 'free');
const items = CHAPTERS.map((chapter, index) => ({ value: String(index), label: `${index + 1}. ${chapter.title}` }));
const current = $derived(items[tour.chapter]);
const arrow =
	'grid size-9 place-items-center rounded-sm text-gold-light transition hover:bg-white/10 disabled:opacity-30';
</script>

<nav
	class="fixed right-4 bottom-4 left-4 overflow-hidden rounded-sm border border-gold/60 bg-lapis-deep/90 text-sm text-papyrus shadow-xl backdrop-blur-sm sm:left-auto"
	aria-label="Tour"
>
	<div class="beads h-[9px]" aria-hidden="true"></div>
	<div class="flex items-center gap-1.5 p-2">
		<Button.Root
			class={arrow}
			disabled={disabled || free || tour.chapter === 0}
			onclick={() => ongo(tour.chapter - 1)}
			aria-label="Previous chapter"
		>
			<Icon icon={arrowLeft} class="size-4" aria-hidden="true" />
		</Button.Root>
		<Select.Root type="single" {items} {disabled} value={current.value} onValueChange={(value) => ongo(Number(value))}>
			<Select.Trigger
				class="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-gold/30 bg-white/5 px-3 py-1.5 text-left disabled:opacity-40 sm:w-64 sm:flex-none"
				aria-label="Chapter"
			>
				<span class="glyph w-8 shrink-0 text-center text-gold-light" aria-hidden="true"
					>{egyptianNumeral(tour.chapter + 1)}</span
				>
				<span class="truncate">{current.label}</span>
				<Icon icon={chevronDown} class="size-3 shrink-0 text-gold-light/80" aria-hidden="true" />
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					class="papyrus z-50 max-h-96 overflow-hidden rounded-sm border border-gold/70 p-1.5 text-sm shadow-xl"
					side="top"
					sideOffset={10}
				>
					<Select.Viewport>
						{#each items as item, index (item.value)}
							<Select.Item
								value={item.value}
								label={item.label}
								class="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-1.5 outline-none data-highlighted:bg-papyrus-deep data-selected:font-semibold data-selected:text-lapis"
							>
								<span class="glyph w-8 text-center text-ochre" aria-hidden="true">{egyptianNumeral(index + 1)}</span>
								{item.label}
							</Select.Item>
						{/each}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
		<Button.Root
			class={arrow}
			disabled={disabled || free || tour.chapter === CHAPTERS.length - 1}
			onclick={() => ongo(tour.chapter + 1)}
			aria-label="Next chapter"
		>
			<Icon icon={arrowRight} class="size-4" aria-hidden="true" />
		</Button.Root>
		<Toggle.Root
			class="rounded-sm border border-gold bg-gold px-3 py-1.5 font-semibold whitespace-nowrap text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition hover:bg-gold-light disabled:opacity-40"
			{disabled}
			pressed={free}
			onPressedChange={() => ontogglefree()}
		>
			{free ? 'Back to the tour' : 'Explore freely'}
		</Toggle.Root>
	</div>
</nav>
