<script lang="ts">
import Icon from '@iconify/svelte';
import volumeOn from '@iconify-icons/lucide/volume-2';
import volumeOff from '@iconify-icons/lucide/volume-x';
import { Toggle } from 'bits-ui';

let {
	pressed,
	disabled = false,
	onchange
}: {
	pressed: boolean;
	disabled?: boolean;
	onchange: (enabled: boolean) => void;
} = $props();
</script>

<Toggle.Root
	{pressed}
	{disabled}
	onPressedChange={onchange}
	aria-label={pressed ? 'Mute the soundscape' : 'Play the soundscape'}
	class="flex size-11 items-center justify-center rounded-sm border border-gold/60 bg-lapis-deep/85 text-gold-light shadow-lg backdrop-blur-sm outline-none focus-visible:ring-2 focus-visible:ring-gold-light disabled:opacity-50 data-[state=on]:text-papyrus"
>
	<Icon icon={pressed ? volumeOn : volumeOff} class="size-5" aria-hidden="true" />
</Toggle.Root>
