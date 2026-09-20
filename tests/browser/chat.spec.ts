import { expect, test, type Page } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4175';
test.use({ baseURL });

async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message the assistant' }).fill(text);
  const request = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/chat') && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  return (await request).postDataJSON() as {
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
  };
}

test('streams schema-valid points inside the assistant message, keeps the chart mounted, and follows up inline', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const input = await send(page, 'Plot revenue and costs.');
  const replies = page.getByTestId('assistant-message');
  const chart = replies.first().getByTestId('line-chart');
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute('data-points', '0');
  await expect(replies.first()).toHaveAttribute('data-status', 'streaming');
  await chart.evaluate((element) =>
    element.setAttribute('data-preserved', 'yes'),
  );
  expect(
    (await request.post(`/__test/advance/${input.sessionId}`)).status(),
  ).toBe(200);
  await expect(chart).toHaveAttribute('data-points', '1');
  await expect(chart.getByLabel('Revenue Jan: 120USD')).toBeAttached();
  expect(
    (await request.post(`/__test/advance/${input.sessionId}`)).status(),
  ).toBe(200);
  await expect(replies.first()).toHaveAttribute('data-status', 'complete');
  await expect(chart).toHaveAttribute('data-points', '4');
  await expect(chart).toHaveAttribute('data-series', '2');
  await expect(chart).toHaveAttribute('data-preserved', 'yes');
  await chart.getByRole('button', { name: 'Revenue', exact: true }).click();
  await expect(
    chart.getByRole('button', { name: 'Revenue', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  const table = replies.first().getByTestId('data-table');
  await table.getByRole('button', { name: 'Revenue' }).click();
  await table.getByRole('button', { name: 'Revenue' }).click();
  await expect(table.locator('tbody tr').first()).toContainText('Feb');
  await replies
    .first()
    .getByRole('checkbox', { name: 'Review the report' })
    .check();
  await expect(
    replies.first().getByRole('checkbox', { name: 'Review the report' }),
  ).toBeChecked();
  const followup = await send(page, 'Which month is higher?');
  expect(followup.messages.map((message) => message.role)).toEqual([
    'user',
    'assistant',
    'user',
  ]);
  expect(followup.messages[1]?.content).toContain('<line-chart>');
  await expect(replies).toHaveCount(2);
  await expect(replies.last()).toContainText('February is higher: 140 USD.');
  await expect(chart).toHaveAttribute('data-points', '4');
  await expect(page.getByText('Rendering notes', { exact: false })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test('stops upstream inference, restores partial replies after reload, and retries on a narrow screen', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const input = await send(page, 'Plot revenue.');
  const reply = page.getByTestId('assistant-message');
  await expect(reply.getByTestId('line-chart')).toHaveAttribute(
    'data-points',
    '0',
  );
  await page
    .getByRole('button', { name: 'Stop response', exact: true })
    .click();
  await expect(reply).toHaveAttribute('data-status', 'stopped');
  await expect
    .poll(
      async () =>
        (await (await request.post(`/__test/status/${input.sessionId}`)).json())
          .aborted,
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem('streamtag-chat:conversations:v1') || '[]',
        );
        return saved[0]?.messages.at(-1)?.status;
      }),
    )
    .toBe('stopped');
  await page.reload();
  await expect(reply).toHaveAttribute('data-status', 'stopped');
  await expect(reply.getByTestId('line-chart')).toHaveAttribute(
    'data-points',
    '0',
  );
  const retried = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/chat') && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  expect((await retried).postDataJSON().messages).toEqual(input.messages);
  await expect(reply).toHaveAttribute('data-status', 'streaming');
  await expect(reply.getByTestId('line-chart')).toHaveAttribute(
    'data-points',
    '0',
  );
  expect(
    (await request.post(`/__test/advance/${input.sessionId}`)).status(),
  ).toBe(200);
  await expect(reply.getByTestId('line-chart')).toHaveAttribute(
    'data-points',
    '1',
  );
  expect(
    (await request.post(`/__test/advance/${input.sessionId}`)).status(),
  ).toBe(200);
  await expect(reply).toHaveAttribute('data-status', 'complete');
  await expect(reply).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
