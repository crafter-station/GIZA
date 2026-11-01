<script lang="ts">
import '@fontsource-variable/inter';
import '@fontsource-variable/cormorant-garamond';
import '@fontsource/noto-sans-egyptian-hieroglyphs';
import './layout.css';
import favicon from '#lib/assets/favicon.svg';
import type { LayoutProps } from './$types';

let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon}>
</svelte:head>

{@render children()}
