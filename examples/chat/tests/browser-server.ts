import type { ChatRequest } from '../shared/protocol';
import type { ModelGateway } from '../server/models';
import { createApp } from '../server/app';

// Test-only deterministic model. Never imported by the production entry point.
interface Session {
  advance?: () => void;
  aborted: boolean;
  messages: ChatRequest['messages'];
}
const sessions = new Map<string, Session>();
const gateway: ModelGateway = {
  models: [{ id: 'test-model', label: 'Test model' }],
  defaultModel: 'test-model',
  async *generate(input, signal) {
    const session: Session = { aborted: false, messages: input.messages };
    sessions.set(input.sessionId, session);
    const step = () =>
      new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const abort = () => {
          session.aborted = true;
          session.advance = undefined;
          reject(signal.reason);
        };
        session.advance = () => {
          signal.removeEventListener('abort', abort);
          session.advance = undefined;
          resolve();
        };
        signal.addEventListener('abort', abort, { once: true });
      });
    if (input.messages.length > 1) {
      yield {
        text: '<section class="reply"><p>February is higher: 140 USD.</p></section>',
      };
      yield { finishReason: 'stop' };
      return;
    }
    yield {
      text: '<section class="reply"><p>Here is the revenue trend.</p><line-chart><title>Revenue trend</title><unit>USD</unit><series><item><name>Revenue</name><points><item><label>Jan</label><value>12',
    };
    await step();
    yield { text: '0</value></item>' };
    await step();
    yield {
      text: '<item><label>Feb</label><value>140</value></item></points></item><item><name>Costs</name><points><item><label>Jan</label><value>60</value></item><item><label>Feb</label><value>70</value></item></points></item></series></line-chart><data-table><title>Monthly revenue</title><columns><item>Month</item><item>Revenue</item></columns><rows><item><cells><item>Jan</item><item>120</item></cells></item><item><cells><item>Feb</item><item>140</item></cells></item></rows></data-table><task-list><title>Next steps</title><items><item><title>Review the report</title><status>pending</status></item></items></task-list></section>',
    };
    yield { finishReason: 'stop' };
  },
};

const runtime = await createApp(gateway, { port: 4175 });
runtime.app.post('/__test/:action/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return void res.sendStatus(404);
  if (req.params.action === 'advance') {
    if (!session.advance) return void res.sendStatus(409);
    session.advance();
  }
  res.json({
    aborted: session.aborted,
    messages: session.messages,
    waiting: Boolean(session.advance),
  });
});
runtime.server.listen(4175, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void runtime.close().then(() => process.exit(0));
  });
}
