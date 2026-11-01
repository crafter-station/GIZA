import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

for (const variant of ['adaptive-backend', 'webgl'] as const) {
	test(`lighting presets remain usable with ${variant}`, async ({ page }, testInfo) => {
		test.setTimeout(180_000);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		await page.setViewportSize({ width: 960, height: 600 });
		await page.goto(`/?tier=low&noao&t=0.4&lighting=noon${variant === 'webgl' ? '&backend=webgl' : ''}`);
		await expect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });
		if (variant === 'webgl') await expect(page.locator('html')).toHaveAttribute('data-backend', 'webgl2');
		const lighting = page.getByRole('combobox', { name: 'Lighting', exact: true });
		const chapter = await page.getByRole('combobox', { name: 'Chapter', exact: true }).textContent();
		const hashes = new Set<string>();
		for (const [mode, label] of [
			['dawn', 'Dawn'],
			['noon', 'Midday'],
			['sunset', 'Sunset'],
			['night', 'Moonlit night']
		] as const) {
			await lighting.click({ force: true });
			await page.getByRole('option', { name: label, exact: true }).click({ force: true });
			await expect(page.locator('html')).toHaveAttribute('data-lighting', mode);
			await expect(lighting).toContainText(label);
			await expect(page.getByRole('listbox')).toHaveCount(0);
			await page.evaluate(
				() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
			);
			const shot = await page.screenshot({ path: testInfo.outputPath(`${mode}.png`), animations: 'disabled' });
			hashes.add(createHash('sha256').update(shot).digest('hex'));
		}
		await lighting.click({ force: true });
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('combobox', { name: 'Chapter', exact: true })).toHaveText(chapter ?? '');
		await expect(lighting).toBeFocused();
		await page.setViewportSize({ width: 390, height: 844 });
		await lighting.click({ force: true });
		await page.getByRole('option', { name: 'Follow the journey', exact: true }).click({ force: true });
		await expect(page.locator('html')).toHaveAttribute('data-lighting', 'tour');
		await expect(lighting).toBeInViewport();
		expect(hashes.size).toBe(4);
		expect(errors).toEqual([]);
	});
}

test('the full temporal pipeline renders and survives a camera cut and resize', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'The full pipeline requires the Chromium WebGPU test project');
	test.setTimeout(180_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await page.setViewportSize({ width: 960, height: 640 });
	await page.goto('/?tier=high&lighting=sunset');
	await expect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });
	const backend = await page.locator('html').getAttribute('data-backend');
	test.skip(backend !== 'webgpu', 'The headless browser exposed no WebGPU adapter on this machine');
	await expect(page.locator('html')).toHaveAttribute('data-tier', 'high');
	await page.getByRole('combobox', { name: 'Chapter', exact: true }).click({ force: true });
	await page.getByRole('option', { name: /3\. Khufu/ }).click({ force: true });
	await expect(page.getByRole('combobox', { name: 'Chapter', exact: true })).toContainText('Khufu', {
		timeout: 15_000
	});
	await page.setViewportSize({ width: 800, height: 600 });
	await page.screenshot({ path: testInfo.outputPath('high-after-cut.png') });
	await page.getByRole('combobox', { name: 'Lighting', exact: true }).click({ force: true });
	await page.getByRole('option', { name: 'Moonlit night', exact: true }).click({ force: true });
	await expect(page.locator('html')).toHaveAttribute('data-lighting', 'night');
	await page.screenshot({ path: testInfo.outputPath('high-night.png') });
	expect(errors).toEqual([]);
});
