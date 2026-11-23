import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The mod editor is served at /editor/ on the site's one origin, next to the
// portal (/), the game (/play/), the casino (/casino/) and the services. In
// development this server passes their paths on to their own dev servers, as
// the portal's does: open it through the portal (http://localhost:5174/editor/)
// or alone (http://localhost:5176/editor/: the game opened from here, /play/,
// shares this origin, and so the mods installed from the editor).
export default defineConfig({
  base: '/editor/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      // the game's dev server: its sprites, font and texts, and the game itself (to play a mod)
      '^/play(/|$)': { target: process.env.BALATRO_GAME ?? 'http://localhost:5173', ws: true },
      // the game API (uv run balatro-api): the catalog, the registry, test runs
      '/api': process.env.BALATRO_API ?? 'http://127.0.0.1:8000',
      // the identity service (make run): the account, refreshing the session
      '/identity': {
        target: process.env.BALATRO_IDENTITY ?? 'http://127.0.0.1:8001',
        rewrite: (path) => path.replace(/^\/identity/, ''),
      },
      // (the game, opened from here, also asks these)
      '/reports': {
        target: process.env.BALATRO_REPORTS ?? 'http://127.0.0.1:8003',
        rewrite: (path) => path.replace(/^\/reports/, ''),
      },
      '/items': {
        target: process.env.BALATRO_ITEMS ?? 'http://127.0.0.1:8004',
        rewrite: (path) => path.replace(/^\/items/, ''),
      },
      '/social': {
        target: process.env.BALATRO_SOCIAL ?? 'http://127.0.0.1:8005',
        rewrite: (path) => path.replace(/^\/social/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    // (React and the router in a chunk of their own: they change less often than the editor)
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router'] } } },
    chunkSizeWarningLimit: 700,
  },
});
