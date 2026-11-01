<script lang="ts">
import type { TourState } from '../app/state.ts';
import { egyptianNumeral, PYRAMID_SIGN } from '../content/hieroglyphs.ts';
import { CHAPTERS, chapterVisibility } from '../tour/chapters.ts';

interface Props {
	tour: TourState;
}

let { tour }: Props = $props();
</script>

{#each CHAPTERS as chapter, index (chapter.id)}
	{@const visibility = tour.mode === 'free' ? 0 : chapterVisibility(tour.t, index, CHAPTERS.length)}
	<article
		id={chapter.id}
		class="papyrus pointer-events-none fixed right-4 bottom-24 left-4 max-w-sm overflow-hidden rounded-sm border border-gold/70 shadow-[0_18px_40px_-18px_rgb(42_31_20/0.7)] sm:right-auto sm:left-6"
		style:opacity={visibility}
		style:transform="translateY({(1 - visibility) * 14}px)"
		aria-hidden={visibility === 0}
	>
		<div class="frieze h-[7px]" aria-hidden="true"></div>
		<div class="flex gap-4 p-5">
			<div class="flex w-10 shrink-0 flex-col items-center border-r border-gold/50 pr-4">
				<span class="glyph text-3xl text-ochre" aria-hidden="true">{egyptianNumeral(index + 1)}</span>
				<span class="mt-2 text-[10px] font-semibold tracking-widest text-ink/60">{index + 1}</span>
			</div>
			<div class="min-w-0">
				<p class="text-[10px] font-semibold tracking-[0.3em] text-ochre uppercase">Chapter {index + 1}</p>
				<h2 class="mt-1 font-display text-[1.9rem] leading-[1.05] font-semibold text-ink sm:text-[2.15rem]">
					{chapter.title}
				</h2>
				<p class="mt-2.5 text-sm leading-relaxed text-ink/80">{chapter.summary}</p>
				<p class="register mt-4 flex items-center gap-2 pt-2 text-[10px] tracking-[0.25em] text-ink/50 uppercase">
					<span class="glyph text-sm text-gold" aria-hidden="true">{PYRAMID_SIGN}</span>
					Giza · {index + 1} / {CHAPTERS.length}
				</p>
			</div>
		</div>
	</article>
{/each}
