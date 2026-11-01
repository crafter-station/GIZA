<script lang="ts">
interface Props {
	glyphs: string;
	name: string;
	transliteration: string;
	vertical?: boolean;
	size?: 'sm' | 'md';
}

let { glyphs, name, transliteration, vertical = true, size = 'md' }: Props = $props();
</script>

<span
	class="cartouche relative inline-flex shrink-0 items-center justify-center border-[1.5px] border-ink/80 bg-papyrus-deep/40 text-ink shadow-[inset_0_0_0_2px_var(--color-papyrus),inset_0_0_0_3px_var(--color-gold)]"
	class:vertical
	class:small={size === 'sm'}
	role="img"
	aria-label="{name} written in hieroglyphs ({transliteration})"
	title="{name} · {transliteration}"
>
	<span class="glyph" aria-hidden="true">{glyphs}</span>
</span>

<style>
.cartouche {
	border-radius: 999px;
	padding: 0.35rem 0.9rem 0.35rem 0.75rem;
	font-size: 1.35rem;
	letter-spacing: 0.04em;
}

.cartouche::after {
	content: "";
	position: absolute;
	right: -6px;
	top: 18%;
	bottom: 18%;
	width: 4px;
	border-radius: 2px;
	background: var(--color-ink);
	opacity: 0.8;
}

.cartouche.vertical {
	flex-direction: column;
	padding: 0.75rem 0.4rem 0.9rem;
	writing-mode: vertical-rl;
	text-orientation: upright;
}

.cartouche.vertical::after {
	right: 18%;
	left: 18%;
	top: auto;
	bottom: -6px;
	width: auto;
	height: 4px;
}

.cartouche.small {
	font-size: 1rem;
}
</style>
