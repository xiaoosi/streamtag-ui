import { z } from 'zod';

export const chatRequestSchema = z
  .object({
    model: z.string().min(1).max(100),
    sessionId: z.string().uuid(),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().min(1).max(60_000),
        }),
      )
      .min(1)
      .max(40),
  })
  .refine(
    (input) =>
      input.messages.reduce(
        (sum, message) => sum + message.content.length,
        0,
      ) <= 240_000,
    'Conversation is too long. Start a new conversation.',
  );

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export interface ModelOption {
  id: string;
  label: string;
}

export const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), model: z.string() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    finishReason: z.enum(['stop', 'length']),
    elapsedMs: z.number(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof streamEventSchema>;

/** HTTP chunks may split UTF-8 characters and JSON records at arbitrary boundaries. */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield streamEventSchema.parse(JSON.parse(line));
      }
      if (done) break;
    }
    if (buffer.trim()) yield streamEventSchema.parse(JSON.parse(buffer));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
