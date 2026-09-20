import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4174' });

test('runs the standalone Tailwind consumer and resets through keyboard input', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Received characters' });
  await expect(page.getByTestId('activity-feed')).toHaveCount(0);
  await slider.press('End');
  await expect(page.getByTestId('activity-feed').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('tailwind-metrics')).toHaveCSS(
    'display',
    'grid',
  );
  await expect(
    page.getByTestId('tailwind-metrics').locator('article').first(),
  ).toHaveCSS('padding', '20px');
  await page.getByText('Model instructions', { exact: true }).click();
  await expect(page.locator('details pre')).toContainText('activity-feed');
  await slider.press('Home');
  await expect(page.getByTestId('activity-feed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show complete' }).click();
  await expect(page.getByTestId('activity-feed').locator('li')).toHaveCount(3);
  expect(errors).toEqual([]);
});
