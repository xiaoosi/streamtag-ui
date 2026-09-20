import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApi } from './api';
import type { ModelGateway } from './models';
import type { ViteDevServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function createApp(
  gateway: ModelGateway,
  options: { port: number; production?: boolean },
) {
  const app = express();
  const server = createHttpServer(app);
  app.disable('x-powered-by');
  app.use(
    '/api',
    createApi(gateway, {
      allowedOrigins: [
        `http://127.0.0.1:${options.port}`,
        `http://localhost:${options.port}`,
      ],
    }),
  );
  let vite: ViteDevServer | undefined;
  if (options.production) {
    app.use(express.static(resolve(root, 'dist')));
    app.get('/{*path}', (_req, res) =>
      res.sendFile(resolve(root, 'dist/index.html')),
    );
  } else {
    const { createServer } = await import('vite');
    vite = await createServer({
      root,
      server: { middlewareMode: true, hmr: { server } },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('/{*path}', async (req, res, next) => {
      try {
        const template = await readFile(resolve(root, 'index.html'), 'utf8');
        res
          .type('html')
          .send(await vite!.transformIndexHtml(req.originalUrl, template));
      } catch (error) {
        next(error);
      }
    });
  }
  return {
    app,
    server,
    async close() {
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    },
  };
}
