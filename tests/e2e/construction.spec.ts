import { expect as baseExpect, test } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 45_000 });

test('the build timeline, ramp hypotheses and stone origins work without errors', async ({ page }) => {
	test.setTimeout(420_000);
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/?tier=low&noao#khufu');
	await expect(page.locator('html')).toHaveAttribute('data-engine', 'ready', { timeout: 90_000 });

	const counters = page.getByTestId('build-counters');
	await page.getByRole('region', { name: 'Construction' }).getByRole('slider').focus();
	await page.keyboard.press('End');
	await expect(counters).toContainText('26 of 26');
	await expect(counters).toContainText('2,300,000');
	await expect(counters).toContainText('201');

	const ramp = page.getByRole('combobox', { name: 'Ramp hypothesis' });
	await ramp.focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(ramp).toContainText('Internal ramp');
	await expect(page.getByText('proposed by Jean-Pierre Houdin')).toBeVisible();

	await page.getByRole('button', { name: 'Show where the stone came from' }).click({ force: true });
	await expect(page.getByTestId('stone-legend')).toContainText('Aswan granite');
	await page.getByRole('button', { name: 'Hide where the stone came from' }).click({ force: true });
	await expect(page.getByTestId('stone-legend')).toHaveCount(0);

	await page.getByRole('button', { name: 'Show the finished pyramid' }).click({ force: true });
	await expect(page.getByRole('button', { name: 'Show the finished pyramid' })).toBeDisabled();
	expect(errors).toEqual([]);
});
