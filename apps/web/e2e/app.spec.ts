import { expect, test } from '@playwright/test';

test('renders the product shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /Work Archive/i })).toBeVisible();
});
