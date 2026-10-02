/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run build:pages` builds with --mode pages: assets are served from
// /togglepulse/ on GitHub Pages and the client swaps the Express API for the
// in-browser demo adapter (see src/services/index.ts).
export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === 'pages';
  // loadEnv reads .env / .env.local (see .env.example); a real environment
  // variable of the same name wins over the file.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: isPagesBuild ? '/togglepulse/' : '/',
    define: {
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify(isPagesBuild ? 'true' : 'false'),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
