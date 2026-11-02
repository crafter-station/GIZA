<script lang="ts">
import Icon from '@iconify/svelte';
import mouseDown from '@iconify-icons/andrsrxn/mouse-down';
import { fade } from 'svelte/transition';
</script>

<div
	class="pointer-events-none fixed bottom-24 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-papyrus drop-shadow-[0_2px_6px_rgb(20_14_8/0.7)] sm:bottom-6"
	role="status"
	aria-label="Scroll to continue the journey"
	transition:fade={{ duration: 300 }}
	data-testid="scroll-hint"
>
	<Icon icon={mouseDown} class="size-9 animate-bounce motion-reduce:animate-none" aria-hidden="true" />
	<span class="text-[10px] font-semibold tracking-[0.3em] uppercase">Scroll</span>
</div>
