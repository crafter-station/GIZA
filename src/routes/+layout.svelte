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
	<link rel="icon" href={favicon} type="image/svg+xml" sizes="any">
	<link rel="icon" href="/favicon.ico" sizes="32x32">
	<link rel="icon" href="/metadata/favicon-16x16.png" type="image/png" sizes="16x16">
	<link rel="icon" href="/metadata/favicon-32x32.png" type="image/png" sizes="32x32">
	<link rel="apple-touch-icon" href="/metadata/apple-touch-icon.png" sizes="180x180">
	<link rel="manifest" href="/metadata/site.webmanifest">
	<meta name="theme-color" content="#13254a">
</svelte:head>

{@render children()}
