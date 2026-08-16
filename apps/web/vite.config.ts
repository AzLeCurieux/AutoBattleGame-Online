import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Same page URLs as v1. The production server maps them in apps/server/src/app.ts. */
const PAGES = { main: 'index.html', login: 'login.html', gambling: 'gambling.html', inventory: 'inventory.html', monitoring: 'monitoring.html' };
const ROUTES: Record<string, string> = { '/login': '/login.html', '/gambling': '/gambling.html', '/inventory': '/inventory.html', '/monitoring': '/monitoring.html' };

function pageRoutes(): Plugin {
  return {
    name: 'page-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split('?')[0];
        if (path && ROUTES[path]) req.url = ROUTES[path] + (req.url!.slice(path.length) || '');
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pageRoutes()],
  resolve: { conditions: ['development'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  build: {
    rollupOptions: { input: Object.fromEntries(Object.entries(PAGES).map(([k, f]) => [k, resolve(import.meta.dirname, f)])) },
  },
});
