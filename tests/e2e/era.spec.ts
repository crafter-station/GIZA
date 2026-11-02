import { expect as baseExpect, test } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 45_000 });

test('the reconstruction follows the journey', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'The full 3D transition runs in the Chromium test project');
	test.setTimeout(420_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await page.goto('/?tier=low&noao&t=9.4&lighting=noon');
	await expect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 150_000 });
	await expect(page.locator('html')).toHaveAttribute('data-era', '32');
	expect(errors).toEqual([]);
});
