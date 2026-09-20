import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Start the playground first. An optional URL supports a production preview too.
const baseURL = process.argv[2] ?? 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('../docs/media/', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'streamtag-recording-'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const viewport = { width: 1440, height: 960 };
const errors = [];
try {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: temporary, size: viewport },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByLabel('Chunk size').selectOption('12');
  await page.getByLabel('Playback speed').selectOption('100');
  // Short holds make the recording legible without changing the replay itself.
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Play stream' }).click();
  const chart = page.getByTestId('line-chart');
  await expect(chart).toHaveAttribute('data-series', '1', { timeout: 20000 });
  await chart.evaluate((element) =>
    element.setAttribute('data-preserved', 'yes'),
  );
  await expect(chart).toHaveAttribute('data-series', '2', { timeout: 10000 });
  await expect(chart).toHaveAttribute('data-points', '12', { timeout: 10000 });
  await expect(chart).toHaveAttribute('data-preserved', 'yes');
  await expect(page.getByRole('status')).toHaveText('Complete', {
    timeout: 15000,
  });
  await expect(page.getByTestId('data-table').locator('tbody tr')).toHaveCount(
    6,
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(output, 'playground.png') });
  await page
    .locator('.preview-scroll')
    .evaluate((element) =>
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }),
    );
  await page.waitForTimeout(1300);
  const video = page.video();
  await context.close();
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
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      join(output, 'streaming-demo.mp4'),
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
      join(output, 'streaming-demo.gif'),
    ],
    { stdio: 'inherit' },
  );

  const screenshots = await browser.newPage({ viewport });
  screenshots.on('pageerror', (error) => errors.push(error.message));
  await screenshots.goto(baseURL);
  await screenshots
    .getByLabel('Example', { exact: true })
    .selectOption('tailwind');
  await screenshots.getByRole('button', { name: 'Show complete' }).click();
  await expect(
    screenshots.getByTestId('activity-feed').locator('li'),
  ).toHaveCount(3);
  await screenshots.waitForTimeout(400);
  await screenshots.screenshot({ path: join(output, 'tailwind-example.png') });
  await screenshots.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Recorded and verified demo assets in ${output}`);
} finally {
  await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
