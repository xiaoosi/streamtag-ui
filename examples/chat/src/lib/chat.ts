import {
  readEvents,
  type ChatRequest,
  type StreamEvent,
} from '../../shared/protocol';

export async function streamChat(
  input: ChatRequest,
  signal: AbortSignal,
  onEvent: (event: StreamEvent) => void,
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || `Request failed (HTTP ${response.status})`);
  }
  if (!response.body)
    throw new Error('The browser did not receive a readable response stream.');
  let finished = false;
  for await (const event of readEvents(response.body)) {
    if (event.type === 'error') throw new Error(event.message);
    onEvent(event);
    if (event.type === 'done') {
      finished = true;
      break;
    }
  }
  if (!finished)
    throw new Error(
      'Connection interrupted. Received content has been kept. Please try again.',
    );
}
