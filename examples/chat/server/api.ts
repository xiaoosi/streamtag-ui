import express from 'express';
import { once } from 'node:events';
import { chatRequestSchema, type StreamEvent } from '../shared/protocol';
import { publicModelError, type ModelGateway } from './models';

export function createApi(
  gateway: ModelGateway,
  options: { allowedOrigins: string[]; timeoutMs?: number },
) {
  const api = express.Router();
  api.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && !options.allowedOrigins.includes(origin))
      return void res.status(403).json({ error: 'Origin not allowed.' });
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(express.json({ limit: '1mb' }));
  api.get('/models', (_req, res) =>
    res.json({ models: gateway.models, defaultModel: gateway.defaultModel }),
  );
  api.post('/chat', async (req, res) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success)
      return void res.status(400).json({
        error:
          'The conversation is too long or invalid. Please start a new chat.',
      });
    if (!gateway.models.some((model) => model.id === parsed.data.model))
      return void res.status(400).json({ error: 'Select a configured model.' });

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('timeout')),
      options.timeoutMs ?? 180_000,
    );
    res.on('close', () => controller.abort());
    res.status(200).set({
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const send = async (event: StreamEvent) => {
      controller.signal.throwIfAborted();
      if (res.destroyed || res.writableEnded) return;
      if (!res.write(`${JSON.stringify(event)}\n`))
        await once(res, 'drain', { signal: controller.signal });
    };
    const started = Date.now();
    let characters = 0;
    let finishReason: string | undefined;
    try {
      await send({ type: 'start', model: parsed.data.model });
      for await (const delta of gateway.generate(
        parsed.data,
        controller.signal,
      )) {
        if (delta.text) {
          characters += delta.text.length;
          await send({ type: 'delta', text: delta.text });
        }
        if (delta.finishReason) finishReason = delta.finishReason;
      }
      if (!characters)
        await send({
          type: 'error',
          message:
            'The model returned no reply. Please retry or select another model.',
        });
      else if (finishReason === 'stop' || finishReason === 'length')
        await send({
          type: 'done',
          finishReason,
          elapsedMs: Date.now() - started,
        });
      else
        await send({
          type: 'error',
          message:
            'The model stream ended unexpectedly. Received content has been preserved.',
        });
    } catch (error) {
      if (!res.destroyed && !res.writableEnded) {
        const event: StreamEvent = {
          type: 'error',
          message: controller.signal.aborted
            ? 'The response timed out. Received content has been preserved.'
            : publicModelError(error),
        };
        res.write(`${JSON.stringify(event)}\n`);
      }
    } finally {
      clearTimeout(timer);
      res.end();
    }
  });
  api.use((_req, res) => res.status(404).json({ error: 'Unknown API route.' }));
  api.use(((error, _req, res, _next) => {
    res
      .status(error?.status === 413 ? 413 : 400)
      .json({ error: 'Request body is too large or contains invalid JSON.' });
  }) as express.ErrorRequestHandler);
  return api;
}
