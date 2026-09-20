import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Start a configured examples/chat server first. This makes two real model calls.
// No response interception, fixture, pacing, video cuts, or speed changes.
const baseURL = process.argv[2] ?? 'http://127.0.0.1:5174';
const output = fileURLToPath(new URL('../docs/media/', import.meta.url));
execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
const temporary = await mkdtemp(join(tmpdir(), 'streamtag-chat-recording-'));
const browser = await chromium.launch();
const viewport = { width: 1280, height: 1040 };
const errors = [];
try {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: temporary, size: viewport },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL);
  await expect(page.getByLabel('选择模型')).toBeEnabled();

  // Observe real DOM updates without modifying the application or its stream.
  await page.evaluate(() => {
    window.recordingStates = [];
    window.recordingChart = undefined;
    window.recordingChartPreserved = true;
    const observer = new MutationObserver(() => {
      const chart = document.querySelector('[data-testid="line-chart"]');
      const table = document.querySelector('[data-testid="data-table"]');
      if (chart) {
        window.recordingChart ??= chart;
        window.recordingChartPreserved &&= window.recordingChart === chart;
      }
      const state = {
        series: Number(chart?.getAttribute('data-series') ?? 0),
        points: Number(chart?.getAttribute('data-points') ?? 0),
        rows: Number(table?.getAttribute('data-rows') ?? 0),
      };
      const previous = window.recordingStates.at(-1);
      if (JSON.stringify(previous) !== JSON.stringify(state)) {
        window.recordingStates.push(state);
      }
    });
    observer.observe(document.querySelector('.message-list') ?? document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-series', 'data-points', 'data-rows'],
    });
  });

  const input = page.getByRole('textbox', { name: '发送消息给助手' });
  await input.fill(
    'Here is fictional business data for Jan–Jun: revenue 58, 62, 71, 68, 85, 96; costs 32, 35, 39, 38, 43, 47 ($k). Plot both lines, show monthly profit in a table, and add one short takeaway. Reply in English.',
  );
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const first = page.getByTestId('assistant-message').first();
  await expect(first).toHaveAttribute('data-status', 'complete', {
    timeout: 180000,
  });
  const chart = first.getByTestId('line-chart');
  await expect(chart).toHaveAttribute('data-series', '2');
  await expect(chart).toHaveAttribute('data-points', '12');
  await expect(first.getByTestId('data-table').locator('tbody tr')).toHaveCount(
    6,
  );
  await expect(page.locator('.diagnostics, .reply-error')).toHaveCount(0);
  const observed = await page.evaluate(() => ({
    states: window.recordingStates,
    chartPreserved: window.recordingChartPreserved,
  }));
  assert.ok(
    observed.chartPreserved,
    'Chart must remain mounted while streaming.',
  );
  assert.ok(observed.states.some((state) => state.series === 1));
  assert.ok(
    observed.states.some((state) => state.points > 0 && state.points < 6),
  );
  assert.ok(
    observed.states.some((state) => state.points > 6 && state.points < 12),
  );
  assert.ok(observed.states.some((state) => state.rows > 0 && state.rows < 6));

  await page.waitForTimeout(1200);
  await page
    .locator('.chat-scroll')
    .evaluate((element) => element.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(temporary, 'inline-chat.png') });
  const legend = chart.locator('.chart-legend button').nth(1);
  await legend.click();
  await expect(legend).toHaveAttribute('aria-pressed', 'false');
  await expect(chart.locator('polyline')).toHaveCount(1);
  await page.waitForTimeout(900);
  await legend.click();
  await expect(chart.locator('polyline')).toHaveCount(2);
  await page.waitForTimeout(700);

  await input.fill(
    'Which month had the highest profit? Answer in one English sentence.',
  );
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByTestId('assistant-message')).toHaveCount(2);
  await expect(page.getByTestId('assistant-message').nth(1)).toHaveAttribute(
    'data-status',
    'complete',
    { timeout: 180000 },
  );
  await expect(page.getByTestId('assistant-message').nth(1)).toContainText(
    /Jun|6\s*月|六月/i,
  );
  await expect(page.getByTestId('assistant-message').nth(1)).toContainText(
    '49',
  );
  await expect(page.locator('.diagnostics, .reply-error')).toHaveCount(0);
  await expect(chart).toHaveAttribute('data-points', '12');
  await page.waitForTimeout(2500);
  const video = page.video();
  await context.close();
  if (errors.length) throw new Error(errors.join('\n'));
  const rawVideo = await video.path();
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      rawVideo,
      '-c:v',
      'libx264',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      join(temporary, 'inline-chat.mp4'),
    ],
    { stdio: 'inherit' },
  );
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      rawVideo,
      '-filter_complex',
      'fps=10,scale=1120:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
      '-loop',
      '0',
      join(temporary, 'inline-chat.gif'),
    ],
    { stdio: 'inherit' },
  );
  await mkdir(output, { recursive: true });
  for (const file of [
    'inline-chat.mp4',
    'inline-chat.gif',
    'inline-chat.png',
  ]) {
    await copyFile(join(temporary, file), join(output, file));
  }
  console.log(JSON.stringify({ output, ...observed }, null, 2));
} finally {
  await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
