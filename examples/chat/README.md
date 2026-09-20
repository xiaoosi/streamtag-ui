# Inline chat

A runnable chat starter using **`streamtag-ui@0.1.0` from npm**. Every assistant message owns a `StreamRenderer`: prose, charts, tables, and checklists stream directly into the conversation. Follow-up replies stay inline alongside earlier messages.

[![An inline conversation: chart series and table rows stream into an assistant message, followed by a contextual follow-up.](../../docs/media/inline-chat.gif)](../../docs/media/inline-chat.mp4)

**Natural-language request → streaming chart and table → interaction → follow-up.** Recorded with a real model and fictional input data, at the original speed. [Full-resolution video](../../docs/media/inline-chat.mp4) · [Recording details and reproduction](../../docs/media/README.md#inline-chat-live-model).

The interface and starter prompts are in English; the assistant defaults to English and responds in the user's language. All model connection details are configured on the server. No private repository, provider-specific account, or workspace build of StreamTag is required.

## Quick start

Requires Node.js **22.12+** and pnpm **10.30.3**. From the repository root:

```sh
pnpm install
cp examples/chat/.env.example examples/chat/.env
```

Edit `examples/chat/.env` with your provider's settings:

```dotenv
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_API_KEY=your-api-key
MODEL_NAME=your-model-id
PORT=5174
```

The URL and credentials above are placeholders. Use a provider with **streaming OpenAI-compatible Chat Completions**, including a terminal `finish_reason`. `MODEL_BASE_URL` is the API base URL; the SDK appends `/chat/completions`. This adapter does not implement Responses, Anthropic Messages, or Azure deployment-specific routing.

```sh
pnpm dev:chat
```

Open **http://127.0.0.1:5174** and send a message. Choose a starter prompt to try inline charts or a checklist. To offer several models on the same endpoint with the same key, use comma-separated IDs in `MODEL_NAME`; the first is the default. Set `PORT` if 5174 is already in use.

### Use as an independent project

Copy this directory, including `.env.example`, into your own project. It has a complete manifest and TypeScript configuration and depends on the published package, not `workspace:*`.

```sh
cp .env.example .env
# Fill in the three model settings.
pnpm install
pnpm dev
```

The repository's root lockfile pins dependencies for workspace development. An independently copied example generates its own lockfile.

### Build and serve

```sh
pnpm --filter @streamtag-ui/chat typecheck
pnpm --filter @streamtag-ui/chat build
pnpm --filter @streamtag-ui/chat start
```

Stop the development server before starting on the same port. The Node process serves both the built frontend and the API. Install the full dependency set for this starter: its server runs through `tsx`. Building, type checking, and tests do not need real credentials.

## Included components

| Tag           | Behavior                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `line-chart`  | Series and complete data points appear progressively; legend toggles and point tooltips work with pointer or keyboard. |
| `data-table`  | Configurable columns and rows with sortable headings.                                                                  |
| `metric-card` | Numeric value, unit, and optional comparison.                                                                          |
| `task-list`   | Task descriptions, status, and checkboxes.                                                                             |

These are example React components you can copy, edit, or replace. They are not built into the StreamTag package. Prose and layouts use ordinary HTML and host CSS. All four schemas are in [`shared/catalog.ts`](shared/catalog.ts).

## How the integration works

1. **Describe components.** [`server/prompt.ts`](server/prompt.ts) calls `getComponentDescriptions(catalog)` from `streamtag-ui/server`. The shared catalog imports Zod only, so server-side descriptions do not load React UI code.
2. **Stream inference.** [`server/models.ts`](server/models.ts) sends that prompt and conversation history to your endpoint. Only user messages and completed assistant replies become follow-up context.
3. **Forward deltas.** [`server/api.ts`](server/api.ts) forwards text immediately as NDJSON events. [`src/lib/chat.ts`](src/lib/chat.ts) consumes them and requires an explicit completion event.
4. **Render each message.** `AssistantReply` in [`src/App.tsx`](src/App.tsx) passes that message's accumulated text and streaming status into `StreamRenderer`. A new reply gets a new React key; earlier replies stay mounted.

```tsx
<StreamRenderer
  components={components}
  content={message.content}
  streaming={message.status === 'streaming'}
  onError={onError}
/>
```

The browser batches visual updates at animation frames, while the transport keeps the original deltas. There is no artificial typing animation, completed-answer replay, or separate result page.

## Add your own component

Add a definition to `shared/catalog.ts` and include it in the exported catalog:

```ts
export const scoreDefinition = {
  name: 'score-card',
  description: 'A numeric score with a short label.',
  schema: z.object({ label: z.string(), value: z.number() }),
};
```

Register the React implementation in `src/components/GeneratedComponents.tsx`:

```tsx
defineComponent({
  ...scoreDefinition,
  component: ({ label, value }) => (
    <div className="card">
      <strong>{label}</strong>
      <p>{value}</p>
    </div>
  ),
});
```

The model can then emit `<score-card><label>Quality</label><value>95</value></score-card>` inside a reply. Use `.default([])` for arrays that should start empty and grow while streaming. CSS classes come from `src/styles.css`; any other CSS library can supply the host's styles as well.

## Conversation and interaction boundaries

- Stop cancels the browser request and upstream inference. A three-minute server timeout also aborts inference.
- Cancellation, truncated output, unexpected EOF, and provider errors retain received content and have distinct UI states. Incomplete markup may produce visible rendering diagnostics.
- The latest 12 conversations are stored in this browser. Reloading converts an interrupted in-flight reply into a stopped reply.
- Chart toggles, sorting, and checkbox state are local component interactions. They are not persisted across remounts or sent to the model. This starter has no tool execution or UI-event-to-agent action loop.
- The model has no browsing or code-execution tools. Do not treat its generated data as retrieved facts.
- The server binds to `127.0.0.1`, checks browser origins, and keeps keys out of the browser bundle and public model metadata. `.env` is ignored by Git. This is a local starter, not a public multi-user deployment with authentication and quotas.
- StreamTag renders allowlisted HTML and trusted registered components. It is not a browser security sandbox.

## Tests

```sh
pnpm --filter @streamtag-ui/chat test
# From the repository root:
pnpm check
pnpm exec playwright install chromium
pnpm test:browser
```

Unit and HTTP integration tests cover chunked UTF-8 decoding, configuration, the real SSE model adapter, validation, truncation, timeout, upstream cancellation, and credential-safe errors. Browser tests use a deterministic **test-only** gateway through the same server and client paths; they verify inline rendering, partial numeric values, component identity, follow-up context, interactions, cancellation, refresh recovery, retry, and narrow screens. No paid inference or secrets are needed in CI.

The test gateway is only in `tests/browser-server.ts` and is never loaded by `pnpm dev` or `pnpm start`.

MIT; see [LICENSE](LICENSE).
