import type { ClientToServerEvents, ServerToClientEvents } from '@autobattle/shared';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SESSION_COOKIE, parseCookieHeader, type SessionStore } from '../auth/sessions.js';
import type { Config } from '../config.js';
import type { LeaderboardService } from '../services/leaderboard.js';

export interface Notifier {
  run(userId: number): void;
  inventory(userId: number): void;
  leaderboard(): void;
}

/**
 * Socket.IO is only a push channel (leaderboard, multi-tab sync). All game
 * actions go through validated HTTP endpoints. Auth reuses the httpOnly
 * session cookie — no token in localStorage, no token in URLs.
 */
export function attachRealtime(
  httpServer: HttpServer,
  config: Config,
  sessions: SessionStore,
  leaderboard: LeaderboardService,
): { notifier: Notifier; connections: () => number; close: () => Promise<void> } {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, object, { userId: number }>(httpServer, {
    serveClient: false,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || config.allowedOrigins.has(origin));
    },
  });

  io.use((socket, next) => {
    const userId = sessions.resolve(parseCookieHeader(socket.handshake.headers.cookie, SESSION_COOKIE));
    if (userId == null) return next(new Error('unauthorized'));
    socket.data.userId = userId;
    next();
  });

  let pending: NodeJS.Timeout | null = null;
  const broadcastLeaderboard = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      io.emit('leaderboard:update', leaderboard.snapshot());
    }, 500);
  };

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    void socket.join(`user:${userId}`);
    leaderboard.connect(userId);
    socket.emit('leaderboard:update', leaderboard.snapshot());
    broadcastLeaderboard();
    socket.on('disconnect', () => {
      leaderboard.disconnect(userId);
      broadcastLeaderboard();
    });
  });

  return {
    connections: () => io.engine.clientsCount,
    notifier: {
      run: (userId) => io.to(`user:${userId}`).emit('run:sync'),
      inventory: (userId) => io.to(`user:${userId}`).emit('inventory:sync'),
      leaderboard: broadcastLeaderboard,
    },
    close: () =>
      new Promise((resolve) => {
        if (pending) clearTimeout(pending);
        void io.close(() => resolve());
      }),
  };
}
