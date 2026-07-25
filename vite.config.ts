import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: './src/web',
  build: {
    outDir: path.resolve(__dirname, 'public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Anchored regexes: a bare '/api' prefix match also swallows the
      // `/api.ts` source module and leaves the dev UI blank.
      '^/api/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '^/mcp(/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
