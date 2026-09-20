import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { createApi } from '../server/api';
import { readConfig } from '../server/config';
import { createModelGateway, type ModelGateway } from '../server/models';
import {
  readEvents,
  type ChatRequest,
  type StreamEvent,
} from '../shared/protocol';

const input: ChatRequest = {
  model: 'test-model',
  sessionId: '69a71555-106d-4091-987b-a0b588f7ee9e',
  messages: [{ role: 'user', content: 'Show a chart.' }],
};
const modelOptions = {
  models: [{ id: 'test-model', label: 'test-model' }],
  defaultModel: 'test-model',
};

async function listen(server: Server, context: TestContext) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function apiServer(
  context: TestContext,
  gateway: ModelGateway,
  timeoutMs = 1000,
) {
  const app = express();
  app.use(
    '/api',
    createApi(gateway, {
      allowedOrigins: ['http://localhost:5174'],
      timeoutMs,
    }),
  );
  return listen(createServer(app), context);
}

async function request(base: string, signal?: AbortSignal, body = input) {
  return fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

async function collect(response: Response) {
  const events: StreamEvent[] = [];
  for await (const event of readEvents(response.body!)) events.push(event);
  return events;
}

test('configuration is portable, validates required fields, and never prints secrets', () => {
  const env = {
    MODEL_BASE_URL: 'https://provider.example/v1/',
    MODEL_API_KEY: 'test-key',
    MODEL_NAME: 'first, second, first',
    PORT: '5176',
  };
  assert.deepEqual(readConfig(env), {
    baseURL: 'https://provider.example/v1',
    apiKey: 'test-key',
    modelNames: ['first', 'second'],
    port: 5176,
  });
  assert.throws(
    () => readConfig({}),
    /MODEL_BASE_URL, MODEL_API_KEY, MODEL_NAME/,
  );
  assert.throws(() => readConfig({ ...env, MODEL_NAME: ', ,' }), /MODEL_NAME/);
  assert.throws(() => readConfig({ ...env, PORT: 'invalid' }), /PORT/);
  assert.throws(
    () =>
      readConfig({
        ...env,
        MODEL_BASE_URL: 'https://private-user:private-key@provider.example/v1',
      }),
    (error: Error) => !error.message.includes('private-key'),
  );
});

test('the real model adapter forwards SSE deltas before completion and keeps credentials off the API', async (context) => {
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  context.after(() => release());
  let upstreamRequest: {
    path?: string;
    authorization?: string;
    body?: Record<string, unknown>;
  } = {};
  const upstream = await listen(
    createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      upstreamRequest = {
        path: req.url,
        authorization: req.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString()),
      };
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (content: string | null, finish_reason: string | null) =>
        res.write(
          `data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', model: input.model, choices: [{ index: 0, delta: { content }, finish_reason }] })}\n\n`,
        );
      send('<p>Hello', null);
      await paused;
      send(' world</p>', null);
      send(null, 'stop');
      res.end('data: [DONE]\n\n');
    }),
    context,
  );
  const gateway = createModelGateway({
    baseURL: `${upstream}/v1`,
    apiKey: 'server-only-test-key',
    modelNames: [input.model],
    port: 5174,
  });
  const base = await apiServer(context, gateway);
  const metadata = await (await fetch(`${base}/api/models`)).text();
  assert.ok(!metadata.includes('server-only-test-key'));
  const response = await request(base);
  const iterator = readEvents(response.body!);
  assert.equal((await iterator.next()).value?.type, 'start');
  assert.deepEqual((await iterator.next()).value, {
    type: 'delta',
    text: '<p>Hello',
  });
  assert.equal(upstreamRequest.path, '/v1/chat/completions');
  assert.equal(upstreamRequest.authorization, 'Bearer server-only-test-key');
  assert.equal(upstreamRequest.body?.stream, true);
  assert.equal(upstreamRequest.body?.model, input.model);
  const messages = upstreamRequest.body?.messages as Array<{
    role: string;
    content: string;
  }>;
  assert.equal(messages[0]?.role, 'system');
  assert.match(messages[0]?.content || '', /line-chart/);
  assert.deepEqual(messages.at(-1), input.messages[0]);
  release();
  const rest: StreamEvent[] = [];
  for await (const event of iterator) rest.push(event);
  assert.deepEqual(rest[0], { type: 'delta', text: ' world</p>' });
  assert.equal(rest.at(-1)?.type, 'done');
});

test('request validation and origin checks reject invalid requests before inference', async (context) => {
  let calls = 0;
  const base = await apiServer(context, {
    ...modelOptions,
    async *generate() {
      calls += 1;
      yield { text: 'unreachable' };
    },
  });
  assert.equal(
    (await request(base, undefined, { ...input, model: 'unconfigured' }))
      .status,
    400,
  );
  assert.equal(
    (
      await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${base}/api/models`, {
        headers: { Origin: 'https://foreign.example' },
      })
    ).status,
    403,
  );
  assert.equal(calls, 0);
});

test('premature upstream EOF is an error, and output truncation stays distinct from success', async (context) => {
  for (const finishReason of [undefined, 'length']) {
    const base = await apiServer(context, {
      ...modelOptions,
      async *generate() {
        yield { text: '<p>partial' };
        if (finishReason) yield { finishReason };
      },
    });
    const events = await collect(await request(base));
    const last = events.at(-1);
    if (finishReason) {
      assert.equal(last?.type, 'done');
      assert.ok(last?.type === 'done' && last.finishReason === 'length');
    } else assert.equal(last?.type, 'error');
  }
});

test('timeout aborts inference and emits a terminal error after already streamed text', async (context) => {
  let aborted = false;
  const base = await apiServer(
    context,
    {
      ...modelOptions,
      async *generate(_input, signal) {
        yield { text: '<p>partial' };
        await new Promise((_, reject) =>
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(signal.reason);
            },
            { once: true },
          ),
        );
      },
    },
    80,
  );
  const events = await collect(await request(base));
  assert.equal(aborted, true);
  assert.deepEqual(events[1], { type: 'delta', text: '<p>partial' });
  assert.equal(events.at(-1)?.type, 'error');
  assert.match(JSON.stringify(events.at(-1)), /timed out/);
});

test('browser disconnect aborts the upstream inference', async (context) => {
  let resolveAborted!: () => void;
  const aborted = new Promise<void>((resolve) => {
    resolveAborted = resolve;
  });
  const base = await apiServer(context, {
    ...modelOptions,
    async *generate(_input, signal) {
      yield { text: '<p>partial' };
      await new Promise((_, reject) =>
        signal.addEventListener(
          'abort',
          () => {
            resolveAborted();
            reject(signal.reason);
          },
          { once: true },
        ),
      );
    },
  });
  const controller = new AbortController();
  const iterator = readEvents((await request(base, controller.signal)).body!);
  await iterator.next();
  assert.deepEqual((await iterator.next()).value, {
    type: 'delta',
    text: '<p>partial',
  });
  controller.abort();
  await iterator.return(undefined);
  await aborted;
});

test('gateway errors never leak upstream credentials or response text', async (context) => {
  const base = await apiServer(context, {
    ...modelOptions,
    async *generate() {
      throw new Error('Bearer secret-token at https://private.example');
    },
  });
  const text = JSON.stringify(await collect(await request(base)));
  assert.ok(!text.includes('secret-token'));
  assert.ok(!text.includes('private.example'));
  assert.match(text, /error/);
});
