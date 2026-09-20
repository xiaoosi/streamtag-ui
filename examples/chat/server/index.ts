import { readConfig } from './config';
import { createModelGateway } from './models';
import { createApp } from './app';

try {
  const config = readConfig();
  const runtime = await createApp(createModelGateway(config), {
    port: config.port,
    production: process.argv.includes('--production'),
  });
  runtime.server.listen(config.port, '127.0.0.1', () =>
    console.log(`StreamTag Chat → http://127.0.0.1:${config.port}`),
  );
  runtime.server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void runtime.close().then(() => process.exit(0));
    });
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Could not start StreamTag Chat.',
  );
  process.exitCode = 1;
}
