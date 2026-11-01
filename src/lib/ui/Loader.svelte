<script lang="ts">
import { Progress } from 'bits-ui';

interface Props {
	progress: number;
	step: string;
}

let { progress, step }: Props = $props();
const percent = $derived(Math.round(progress * 100));
</script>

<div class="papyrus pointer-events-none fixed inset-0 grid place-items-center">
	<div class="w-80 text-center">
		<img src="/images/pyramid-sign.webp" alt="" aria-hidden="true" class="mx-auto block h-24 w-44 object-contain">
		<p class="mt-4 font-display text-4xl font-semibold tracking-wide">Giza</p>
		<p class="mt-1 text-[10px] tracking-[0.3em] text-ink/60 uppercase">The pyramids, block by block</p>
		<Progress.Root
			value={percent}
			max={100}
			aria-label="Loading the 3D scene"
			class="beads mt-6 h-[9px] w-full overflow-hidden rounded-sm border border-gold/60"
		>
			<div class="h-full bg-gold transition-[width] duration-300" style:width="{percent}%"></div>
		</Progress.Root>
		<p class="mt-3 text-xs tracking-wide text-ink/70">{step}</p>
	</div>
</div>
