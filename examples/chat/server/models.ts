import OpenAI from 'openai';
import type { ChatRequest, ModelOption } from '../shared/protocol';
import type { ModelConfig } from './config';
import { systemPrompt } from './prompt';

export interface ModelDelta {
  text?: string;
  finishReason?: string;
}

export interface ModelGateway {
  models: ModelOption[];
  defaultModel: string;
  generate(input: ChatRequest, signal: AbortSignal): AsyncIterable<ModelDelta>;
}

/** OpenAI-compatible Chat Completions transport; all credentials stay on the server. */
export function createModelGateway(config: ModelConfig): ModelGateway {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: 0,
    timeout: 180_000,
  });
  const models = config.modelNames.map((id) => ({ id, label: id }));
  const defaultModel = models[0]!.id;
  return {
    models,
    defaultModel,
    async *generate(input, signal) {
      const stream = await client.chat.completions.create(
        {
          model: input.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...input.messages,
          ],
          stream: true,
          max_tokens: 8192,
        },
        { signal },
      );
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta.content) yield { text: choice.delta.content };
        if (choice?.finish_reason) yield { finishReason: choice.finish_reason };
      }
    },
  };
}

export function publicModelError(error: unknown): string {
  // Never expose an upstream response body, URL, credentials, or request headers.
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403)
      return 'Model authorization failed. Check your server-side API key and access permissions.';
    if (error.status === 429)
      return 'The model is rate limited. Please retry later or select another model.';
    return `Model request failed${error.status ? ` (HTTP ${error.status})` : ''}. Please retry.`;
  }
  return 'Could not connect to the model. Check your connection and API configuration.';
}
