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
    throw new Error(body?.error || `请求失败（HTTP ${response.status}）`);
  }
  if (!response.body) throw new Error('浏览器未收到可读取的数据流。');
  let finished = false;
  for await (const event of readEvents(response.body)) {
    if (event.type === 'error') throw new Error(event.message);
    onEvent(event);
    if (event.type === 'done') {
      finished = true;
      break;
    }
  }
  if (!finished) throw new Error('连接中断，已保留收到的页面，请重试。');
}
