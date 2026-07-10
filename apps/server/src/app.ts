import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { GameRuleError } from '@autobattle/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SESSION_COOKIE, SessionStore } from './auth/sessions.js';
import type { Config } from './config.js';
import type { Db } from './db/index.js';
import { HttpError, sendError } from './http.js';
import { attachRealtime, type Notifier } from './realtime/socket.js';
import { authRoutes } from './routes/auth.js';
import { gameRoutes } from './routes/game.js';
import { InventoryError, InventoryService } from './services/inventory.js';
import { LeaderboardService } from './services/leaderboard.js';
import { Monitoring } from './services/monitoring.js';
import { RunService } from './services/runs.js';
import { UserService } from './services/users.js';

export interface AppContext {
  config: Config;
  sessions: SessionStore;
  users: UserService;
  runs: RunService;
  inventory: InventoryService;
  leaderboard: LeaderboardService;
  monitoring: Monitoring;
  notify: Notifier;
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Route → built HTML file. Mirrors the v1 pages. */
export const PAGES: Record<string, string> = {
  '/': 'index.html',
  '/login': 'login.html',
  '/gambling': 'gambling.html',
  '/inventory': 'inventory.html',
  '/monitoring': 'monitoring.html',
};

export async function buildApp(config: Config, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 16 * 1024,
    logger: config.NODE_ENV === 'test' ? false : { level: config.isProd ? 'info' : 'debug' },
  });

  const sessions = new SessionStore(db, config.SESSION_TTL_DAYS);
  const users = new UserService(db);
  const inventory = new InventoryService(db);
  const runs = new RunService(db, users, inventory);
  const leaderboard = new LeaderboardService(db, runs);
  const realtime = attachRealtime(app.server, config, sessions, leaderboard);
  const monitoring = new Monitoring(
    {
      socketConnections: realtime.connections,
      onlineUsers: () => leaderboard.onlineCount(),
      activeRuns: () => runs.countActive(),
      registeredUsers: () => users.count(),
    },
    config.DATABASE_PATH,
    config.PORT,
  );
  const ctx: AppContext = { config, sessions, users, runs, inventory, leaderboard, monitoring, notify: realtime.notifier };

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        // https: because v1 lets players use an image URL as profile picture.
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.secureOrigin ? [] : null,
      },
    },
  });
  await app.register(cookie);
  // Only the API is rate-limited: a single collection page loads ~60 images.
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute', allowList: (req) => !req.url.startsWith('/api/') });

  app.decorateRequest('userId', null);
  app.addHook('onRequest', async (req, reply) => {
    // CSRF defence in depth (cookies are already SameSite=Strict).
    if (STATE_CHANGING.has(req.method) && req.headers.origin !== config.APP_ORIGIN) {
      return sendError(reply, 403, 'BAD_ORIGIN', 'Origine refusée');
    }
    req.userId = sessions.resolve(req.cookies[SESSION_COOKIE]);
    monitoring.bytesIn += Number(req.headers['content-length'] ?? 0);
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    const length = reply.getHeader('content-length') ?? (typeof payload === 'string' ? Buffer.byteLength(payload) : 0);
    monitoring.bytesOut += Number(length) || 0;
    return payload;
  });

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    if (err instanceof HttpError) return sendError(reply, err.status, err.code, err.message);
    if (err instanceof GameRuleError) return sendError(reply, 409, err.code, err.message);
    if (err instanceof InventoryError) {
      return sendError(reply, err.code === 'NOT_FOUND' ? 404 : 409, err.code, err.message);
    }
    const status = err.statusCode;
    if (status && status < 500) return sendError(reply, status, 'REQUEST_ERROR', err.message);
    req.log.error(err);
    return sendError(reply, 500, 'INTERNAL', 'Erreur interne');
  });

  app.get('/api/health', async () => ({ ok: true }));
  authRoutes(app, ctx);
  gameRoutes(app, ctx);

  // Production: serve the built pages. Only the web build directory is exposed —
  // the old server published its whole project root (sources + database).
  const webDist = config.WEB_DIST ? resolve(config.WEB_DIST) : null;
  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      index: false,
      // Vite assets are content-hashed: cache them for good. Pages must always be
      // revalidated (they point to the current hashes). Images: 1 hour.
      setHeaders: (res, path) =>
        res.setHeader(
          'cache-control',
          path.endsWith('.html') ? 'no-cache' : path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
        ),
    });
    // Same URLs as v1. Pages other than /login need a session (checked server-side,
    // so no flash of the page before the redirect).
    for (const [route, file] of Object.entries(PAGES)) {
      app.get(route, (req, reply) => {
        if (route === '/login' && req.userId != null) return reply.redirect('/');
        if (route !== '/login' && req.userId == null) return reply.redirect('/login');
        if (route === '/monitoring' && users.findById(req.userId!)?.role !== 'admin') return reply.redirect('/');
        return reply.sendFile(file);
      });
    }
    app.setNotFoundHandler((req, reply) =>
      // Unknown page → home. Unknown file (has an extension) → real 404, not HTML.
      req.method === 'GET' && !req.url.startsWith('/api/') && !/\.[a-z0-9]+(\?|$)/i.test(req.url)
        ? reply.redirect('/')
        : sendError(reply, 404, 'NOT_FOUND', 'Introuvable'),
    );
  }

  const purge = setInterval(() => sessions.purgeExpired(), 60 * 60 * 1000);
  purge.unref();
  app.addHook('onClose', async () => {
    clearInterval(purge);
    monitoring.stop();
    await realtime.close();
  });

  return app;
}
