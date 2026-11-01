import { expect, type Page, test } from '@playwright/test';

interface Hsl {
	hue: number;
	saturation: number;
	lightness: number;
}

const SAND_REGION = [0.3, 0.86, 0.4, 0.1] as const;

async function measureSand(page: Page, lighting: string): Promise<Hsl> {
	await page.setViewportSize({ width: 800, height: 500 });
	await page.goto(`/?t=2.5&tier=low&noao&lighting=${lighting}`);
	await expect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });
	await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 90_000 });
	await page.addStyleTag({ content: 'aside, nav, article, header, [data-testid] { visibility: hidden !important; }' });
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
	);
	const shot = await page.screenshot();
	return page.evaluate(
		async ({ data, region }) => {
			const image = new Image();
			image.src = data;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d', { willReadFrequently: true });
			if (!context) throw new Error('2D canvas unavailable');
			context.drawImage(image, 0, 0);
			const [x, y, w, h] = region;
			const pixels = context.getImageData(
				Math.floor(x * canvas.width),
				Math.floor(y * canvas.height),
				Math.floor(w * canvas.width),
				Math.floor(h * canvas.height)
			).data;
			const channels: number[][] = [[], [], []];
			for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) channels[c].push(pixels[i + c] / 255);
			const [r, g, b] = channels.map((values) => values.sort((p, q) => p - q)[values.length >> 1]);
			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			const lightness = (max + min) / 2;
			const delta = max - min;
			const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
			let hue = 0;
			if (delta > 0 && max === r) hue = 60 * (((g - b) / delta) % 6);
			else if (delta > 0 && max === g) hue = 60 * ((b - r) / delta + 2);
			else if (delta > 0) hue = 60 * ((r - g) / delta + 4);
			return { hue: (hue + 360) % 360, saturation, lightness };
		},
		{ data: `data:image/png;base64,${shot.toString('base64')}`, region: SAND_REGION }
	);
}

test('sand matches the reference palette at midday and darkens at night', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'Palette regression runs on the Chromium project');
	test.setTimeout(240_000);
	const noon = await measureSand(page, 'noon');
	expect(noon.hue).toBeGreaterThan(24);
	expect(noon.hue).toBeLessThan(42);
	expect(noon.saturation).toBeGreaterThan(0.25);
	expect(noon.lightness).toBeGreaterThan(0.45);
	expect(noon.lightness).toBeLessThan(0.75);
	const night = await measureSand(page, 'night');
	expect(night.lightness).toBeLessThan(0.2);
});
