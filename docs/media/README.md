# Demo recordings

These assets show the real playground rendering fictional sample data. They are not simulated interface animations and do not claim a live model connection.

- `streaming-demo.gif`: embedded README preview.
- `streaming-demo.mp4`: full-resolution recording at 1440 × 960.
- `playground.png`: the completed revenue chart in the playground.
- `tailwind-example.png`: the compiled Tailwind layout and React activity feed.

## Reproduce

Requirements: the workspace dependencies, Playwright Chromium, and `ffmpeg` on your PATH.

From the repository root, start the playground:

```sh
pnpm --filter streamtag-ui build
pnpm --filter @streamtag-ui/playground exec vite --host 127.0.0.1 --port 4173 --strictPort
```

In a second terminal:

```sh
pnpm exec playwright install chromium
node scripts/record-demo.mjs
```

The script records twelve-character chunks at 100 ms intervals. It checks that the first chart series is joined by a second without replacing the chart element, verifies all twelve points and six table rows, and generates the GIF and MP4 from that recording. Pass a different preview URL as the first argument if needed.
