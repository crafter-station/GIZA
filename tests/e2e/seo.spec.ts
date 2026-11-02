import { expect, test } from '@playwright/test';

const TITLE = 'Pyramids of Giza in 3D: Deconstruct Khufu, Block by Block';
const ORIGIN = 'https://giza.crafter.run';

test('the page exposes complete document metadata before hydration', async ({ request }) => {
	const response = await request.get('/');
	expect(response.status()).toBe(200);
	const html = await response.text();

	expect(html).toContain('<html lang="en">');
	expect(html).toContain(`<title>${TITLE}</title>`);
	expect(html).toContain(`rel="canonical" href="${ORIGIN}/"`);
	expect(html).toContain(`property="og:image" content="${ORIGIN}/metadata/og.jpg"`);
	expect(html).toContain('name="twitter:card" content="summary_large_image"');
	expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
});

test('head tags survive hydration without duplicates', async ({ page }) => {
	await page.goto('/?tier=low');
	await expect(page).toHaveTitle(TITLE);
	await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /pyramids of Giza in 3D/);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/`);
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${ORIGIN}/metadata/og.jpg`);
	await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#13254a');

	const structuredData = page.locator('script[type="application/ld+json"]');
	await expect(structuredData).toHaveCount(1);
	const raw = await structuredData.textContent();
	expect(raw).not.toBeNull();
	const graph = JSON.parse(raw ?? '{}');
	expect(graph['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual(['WebSite', 'LearningResource']);
});

test('metadata assets, robots and the sitemap are served', async ({ request }) => {
	const assets = [
		'/favicon.ico',
		'/metadata/favicon-16x16.png',
		'/metadata/favicon-32x32.png',
		'/metadata/apple-touch-icon.png',
		'/metadata/android-chrome-192x192.png',
		'/metadata/android-chrome-512x512.png'
	];
	for (const asset of assets) {
		const response = await request.get(asset);
		expect(response.status(), asset).toBe(200);
	}

	const manifest = await request.get('/metadata/site.webmanifest');
	expect(manifest.status()).toBe(200);
	const parsed = await manifest.json();
	expect(parsed.name).toBe('Giza — The Pyramids in 3D');
	expect(parsed.icons).toHaveLength(3);

	const robots = await request.get('/robots.txt');
	expect(robots.status()).toBe(200);
	expect(await robots.text()).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.status()).toBe(200);
	expect(await sitemap.text()).toContain(`<loc>${ORIGIN}/</loc>`);
});
