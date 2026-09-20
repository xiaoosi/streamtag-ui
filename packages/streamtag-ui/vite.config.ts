import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: { index: 'src/index.ts', server: 'src/server.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        banner: (chunk) => (chunk.name === 'index' ? "'use client';" : ''),
      },
      external: [
        'react',
        'react/jsx-runtime',
        'zod',
        'htmlparser2',
        'style-to-object',
      ],
    },
  },
});
