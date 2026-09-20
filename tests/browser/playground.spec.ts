import { expect, test } from '@playwright/test';

test('replays real chart points and table rows while preserving the chart element', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Chunk size').selectOption('48');
  const chart = page.getByTestId('line-chart');
  // Stepping makes the intermediate-state assertion independent of machine speed.
  for (let step = 0; step < 100; step++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    if (
      (await chart.count()) &&
      Number(await chart.getAttribute('data-points')) > 0
    )
      break;
  }
  await expect(chart).toBeVisible();
  const earlyPoints = Number(await chart.getAttribute('data-points'));
  expect(earlyPoints).toBeGreaterThan(0);
  expect(earlyPoints).toBeLessThan(12);
  await chart.evaluate((element) =>
    element.setAttribute('data-preserved', 'yes'),
  );
  await page.getByRole('button', { name: 'Play stream' }).click();
  await expect(page.getByRole('status')).toHaveText('Complete');
  await expect(chart).toHaveAttribute('data-points', '12');
  await expect(chart).toHaveAttribute('data-series', '2');
  await expect(chart).toHaveAttribute('data-preserved', 'yes');
  await expect(chart.locator('svg')).toBeVisible();
  await expect(page.getByTestId('data-table').locator('tbody tr')).toHaveCount(
    6,
  );
  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(page.getByText('All clear.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('shows completed content, exposes model instructions, and resets', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Show complete' }).click();
  await expect(page.getByTestId('line-chart')).toHaveAttribute(
    'data-points',
    '12',
  );
  await page.getByRole('button', { name: 'Model instructions' }).click();
  await expect(page.locator('.instructions')).toContainText('line-chart');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Ready to stream');
  await expect(page.getByTestId('line-chart')).toHaveCount(0);
});

test('keeps surrounding content after a component validation failure', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Example', { exact: true }).selectOption('errors');
  await page.getByRole('button', { name: 'Show complete' }).click();
  await expect(
    page.getByText('The rest of the report is still visible.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Issues/ }).click();
  await expect(page.locator('.issue')).toContainText('invalid-props');
});

test('reports an explicitly ended incomplete stream', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Source markup').fill('<p>Incomplete');
  await page.getByLabel('Chunk size').selectOption('12');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByRole('button', { name: 'End here', exact: true }).click();
  await page.getByRole('button', { name: /Issues/ }).click();
  await expect(page.locator('.issue')).toContainText('syntax');
});

test('ignores an illegal file input value without crashing the page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page
    .getByLabel('Source markup')
    .fill(
      '<p>Before file input</p><input type="FiLe" value="test.txt"/><p>After file input</p>',
    );
  await page.getByRole('button', { name: 'Show complete' }).click();
  const preview = page.locator('.preview-scroll');
  await expect(
    preview.getByText('Before file input', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('After file input', { exact: true }),
  ).toBeVisible();
  await expect(preview.locator('input')).toHaveValue('');
  await page.getByRole('button', { name: /Issues/ }).click();
  await expect(page.locator('.issue')).toHaveCount(1);
  await expect(page.locator('.issue')).toContainText('invalid-attribute');
  expect(errors).toEqual([]);
});

test('streams a Tailwind component with compiled layout and responsive utilities', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Example', { exact: true }).selectOption('tailwind');
  await page.getByLabel('Chunk size').selectOption('48');
  const feed = page.getByTestId('activity-feed');
  for (let step = 0; step < 60; step++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    if (await feed.locator('li').count()) break;
  }
  const earlyRows = await feed.locator('li').count();
  expect(earlyRows).toBeGreaterThan(0);
  expect(earlyRows).toBeLessThan(3);
  await feed.evaluate((element) =>
    element.setAttribute('data-preserved', 'yes'),
  );
  await page.getByRole('button', { name: 'Play stream' }).click();
  await expect(page.getByRole('status')).toHaveText('Complete');
  await expect(feed.locator('li')).toHaveCount(3);
  await expect(feed).toHaveAttribute('data-preserved', 'yes');
  const metrics = page.getByTestId('tailwind-metrics');
  await expect(metrics).toHaveCSS('display', 'grid');
  expect(
    await metrics.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(3);
  await expect(metrics.locator('article').first()).toHaveCSS('padding', '20px');
  await expect(metrics.locator('article').first()).toHaveCSS(
    'border-top-width',
    '1px',
  );
  await page.getByRole('button', { name: 'Model instructions' }).click();
  await expect(page.locator('.instructions')).toContainText('activity-feed');
  await expect(page.locator('.instructions')).not.toContainText('line-chart');
  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(page.getByText('All clear.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await metrics.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(1);
  expect(
    await page
      .locator('.preview-scroll')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('fits a narrow viewport without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Show complete' }).click();
  await expect(page.getByTestId('line-chart').locator('svg')).toBeVisible();
  const controlsFit = await page.evaluate(
    () =>
      document.querySelector('.stream-controls')!.getBoundingClientRect()
        .bottom <=
      document.querySelector('.workspace-body')!.getBoundingClientRect().bottom,
  );
  expect(controlsFit).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator('.preview-scroll')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});
