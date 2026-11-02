<script lang="ts">
import Icon from '@iconify/svelte';
import chevronDown from '@iconify-icons/lucide/chevron-down';
import { Select } from 'bits-ui';
import type { Snippet } from 'svelte';
import { isLightingMode, LIGHTING_OPTIONS, type LightingMode } from '#lib/world/atmosphere/lighting.ts';

let {
	value,
	disabled = false,
	onchange,
	children
}: {
	value: LightingMode;
	disabled?: boolean;
	onchange: (mode: LightingMode) => void;
	children?: Snippet;
} = $props();

const SIGNS: Record<LightingMode, string> = {
	tour: '𓇶',
	dawn: '𓇶',
	noon: '𓇳',
	sunset: '𓇳',
	night: '𓇹'
};
const label = $derived(LIGHTING_OPTIONS.find((option) => option.value === value)?.label ?? 'Follow the journey');
</script>

<div class="fixed top-4 right-4 z-30 flex items-start gap-2" data-testid="lighting-controls">
	{@render children?.()}
	<Select.Root
		type="single"
		{value}
		{disabled}
		onValueChange={(next) => {
			if (isLightingMode(next)) onchange(next);
		}}
	>
		<Select.Trigger
			aria-label="Lighting"
			class="flex min-h-11 items-center gap-3 rounded-sm border border-gold/60 bg-lapis-deep/85 px-4 py-2 text-sm text-papyrus shadow-lg backdrop-blur-sm outline-none focus-visible:ring-2 focus-visible:ring-gold-light disabled:opacity-50"
		>
			<span class="glyph text-lg text-gold-light" aria-hidden="true">{SIGNS[value]}</span>
			<span class="hidden font-medium sm:inline">{label}</span>
			<Icon icon={chevronDown} class="size-3 shrink-0 text-gold-light/80" aria-hidden="true" />
		</Select.Trigger>
		<Select.Portal>
			<Select.Content
				sideOffset={8}
				align="end"
				class="papyrus z-50 min-w-52 overflow-hidden rounded-sm border border-gold/70 p-1.5 text-sm shadow-xl"
			>
				<Select.Viewport>
					{#each LIGHTING_OPTIONS as option (option.value)}
						<Select.Item
							value={option.value}
							label={option.label}
							class="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 outline-none data-highlighted:bg-papyrus-deep data-selected:font-semibold data-selected:text-lapis"
						>
							<span class="glyph w-5 text-center text-base text-ochre" aria-hidden="true">{SIGNS[option.value]}</span>
							{option.label}
						</Select.Item>
					{/each}
				</Select.Viewport>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</div>
