import { expect as baseExpect, test } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 45_000 });

test('the block spike starts, deconstructs and reassembles without errors', async ({ page }) => {
	test.setTimeout(420_000);
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/?tier=low&noao#khufu');
	await expect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });
	await expect(page.getByRole('heading', { level: 2, name: 'Khufu, block by block' })).toBeVisible();
	await expect(page.getByTestId('engine-info')).toContainText('low');

	const blockControls = page.getByRole('complementary', { name: 'Deconstruction controls' });
	await expect(blockControls).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(blockControls).toBeHidden();
	await page.getByRole('button', { name: 'Open block controls' }).click();
	await expect(blockControls).toBeVisible();
	await page.getByRole('button', { name: 'Close block controls' }).click();
	await expect(blockControls).toBeHidden();
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(blockControls).toBeVisible();

	await page.getByRole('button', { name: 'Deconstruct' }).click({ force: true });
	await expect(page.getByRole('button', { name: 'Reassemble' })).toBeEnabled();
	await page.getByRole('button', { name: 'Reassemble' }).click({ force: true });
	await expect(page.getByRole('button', { name: 'Deconstruct' })).toBeEnabled();
	expect(errors).toEqual([]);
});
