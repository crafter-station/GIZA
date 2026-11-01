import { createHash } from 'node:crypto';
import { expect, type Locator, type Page, test } from '@playwright/test';

const slowExpect = expect.configure({ timeout: 45_000 });

async function chooseOption(page: Page, combobox: Locator, label: string | RegExp): Promise<void> {
	await combobox.focus();
	await page.keyboard.press('Enter');
	await slowExpect(page.getByRole('listbox')).toBeVisible();
	const options = await page.getByRole('option').allTextContents();
	const target = options.findIndex((text) =>
		typeof label === 'string' ? text.trim().endsWith(label) : label.test(text)
	);
	if (target < 0) throw new Error(`Option not found: ${label}`);
	await page.keyboard.press('Home');
	for (let i = 0; i < target; i++) await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await slowExpect(page.getByRole('listbox')).toHaveCount(0);
}

for (const variant of ['adaptive-backend', 'webgl'] as const) {
	test(`lighting presets remain usable with ${variant}`, async ({ page }, testInfo) => {
		test.setTimeout(420_000);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		await page.setViewportSize({ width: 960, height: 600 });
		await page.goto(`/?tier=low&noao&t=0.4&lighting=noon${variant === 'webgl' ? '&backend=webgl' : ''}`);
		await slowExpect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });
		if (variant === 'webgl') await slowExpect(page.locator('html')).toHaveAttribute('data-backend', 'webgl2');
		const lighting = page.getByRole('combobox', { name: 'Lighting', exact: true });
		const chapter = await page.getByRole('combobox', { name: 'Chapter', exact: true }).textContent();
		const hashes = new Set<string>();
		const choose = (label: string) => chooseOption(page, lighting, label);
		for (const [mode, label] of [
			['dawn', 'Dawn'],
			['noon', 'Midday'],
			['sunset', 'Sunset'],
			['night', 'Moonlit night']
		] as const) {
			await choose(label);
			await slowExpect(page.locator('html')).toHaveAttribute('data-lighting', mode);
			await slowExpect(lighting).toContainText(label);
			await slowExpect(page.getByRole('listbox')).toHaveCount(0);
			await page.evaluate(
				() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
			);
			const shot = await page.screenshot({ path: testInfo.outputPath(`${mode}.png`), animations: 'disabled' });
			hashes.add(createHash('sha256').update(shot).digest('hex'));
		}
		await lighting.focus();
		await page.keyboard.press('Enter');
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Escape');
		await slowExpect(page.getByRole('combobox', { name: 'Chapter', exact: true })).toHaveText(chapter ?? '');
		await slowExpect(lighting).toBeFocused();
		await page.setViewportSize({ width: 390, height: 844 });
		await choose('Follow the journey');
		await slowExpect(page.locator('html')).toHaveAttribute('data-lighting', 'tour');
		await slowExpect(lighting).toBeInViewport();
		expect(hashes.size).toBe(4);
		expect(errors).toEqual([]);
	});
}

test('the full temporal pipeline renders and survives a camera cut and resize', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'The full pipeline requires the Chromium WebGPU test project');
	test.setTimeout(420_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await page.setViewportSize({ width: 960, height: 640 });
	await page.goto('/?tier=high&lighting=sunset');
	await slowExpect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });
	const backend = await page.locator('html').getAttribute('data-backend');
	test.skip(backend !== 'webgpu', 'The headless browser exposed no WebGPU adapter on this machine');
	await slowExpect(page.locator('html')).toHaveAttribute('data-tier', 'high');
	await chooseOption(page, page.getByRole('combobox', { name: 'Chapter', exact: true }), /3\. Khufu/);
	await slowExpect(page.getByRole('combobox', { name: 'Chapter', exact: true })).toContainText('Khufu', {
		timeout: 15_000
	});
	await page.setViewportSize({ width: 800, height: 600 });
	await page.screenshot({ path: testInfo.outputPath('high-after-cut.png') });
	await chooseOption(page, page.getByRole('combobox', { name: 'Lighting', exact: true }), 'Moonlit night');
	await slowExpect(page.locator('html')).toHaveAttribute('data-lighting', 'night');
	await page.screenshot({ path: testInfo.outputPath('high-night.png') });
	expect(errors).toEqual([]);
});
