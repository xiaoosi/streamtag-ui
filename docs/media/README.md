# Demo recordings

These are browser recordings of the running applications, using fictional business data. The chat connects to a real model; the playground replays saved markup.

## Inline chat: live model

- [`inline-chat.gif`](inline-chat.gif): the main README preview.
- [`inline-chat.mp4`](inline-chat.mp4): the 17-second full recording at 1280 × 1040.
- [`inline-chat.png`](inline-chat.png): the completed first reply.

The recording shows the published `streamtag-ui@0.1.0` package in `examples/chat`: a natural-language request, two chart series growing point by point, a profit table filling row by row, a legend toggle, and a contextual follow-up in the same conversation.

Both replies are live DeepSeek V4 Flash responses. The footage is continuous, with no time cuts, speed changes, delayed deltas, or prerecorded responses. The GIF reduces resolution and frame rate for the README. Model latency, output, and layout will vary between runs. English prompts make the example data readable to a wider audience; the chat interface is Chinese.

### Record your own conversation

Install workspace dependencies, Playwright Chromium, and `ffmpeg` on your `PATH`. Follow the [chat setup](../../examples/chat/README.md#quick-start) to configure a streaming model on the server, then start it:

```sh
pnpm dev:chat
```

In another terminal, from the repository root:

```sh
pnpm exec playwright install chromium
node scripts/record-chat-demo.mjs
# Or pass your running chat URL as the first argument.
```

This makes two real model requests using the configured default model and may incur provider charges. It opens an isolated browser context, so existing conversations are not included. Keep the visible model name suitable for a public recording; never put a credential in it.

The script observes real DOM updates and requires both series to gain points progressively, the same chart element to stay mounted, six table rows, a working legend toggle, and a completed follow-up about June's $49k profit. It fails if these checks or browser rendering fail, and replaces media files only after verification. It does not intercept the API or use the browser-test gateway. Review the footage before publishing.

## Playground: markup replay

- `streaming-demo.gif`: embedded README preview.
- `streaming-demo.mp4`: full-resolution recording at 1440 × 960.
- `playground.png`: the completed revenue chart in the playground.
- `tailwind-example.png`: the compiled Tailwind layout and React activity feed.

### Reproduce

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
