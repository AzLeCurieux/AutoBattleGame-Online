import { AvatarSchema, CredentialsSchema, RegisterSchema } from '@autobattle/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../auth/password.js';
import { SESSION_COOKIE } from '../auth/sessions.js';
import { HttpError, parse, requireUser } from '../http.js';
import type { AppContext } from '../app.js';

export function authRoutes(app: FastifyInstance, { config, sessions, users, runs, notify }: AppContext) {
  const setSessionCookie = (reply: FastifyReply, userId: number) => {
    const { token, expiresAt } = sessions.create(userId);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.secureOrigin,
      path: '/',
      expires: new Date(expiresAt),
    });
  };

  // Public list for the profile picker. Only what the picker shows: no ids, no stats.
  app.get('/api/auth/users', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () =>
    users.listProfiles(),
  );

  app.post('/api/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    const body = parse(RegisterSchema, req.body);
    const user = users.create(body.username, await hashPassword(body.password), body.isPin);
    if (!user) throw new HttpError(409, 'USERNAME_TAKEN', 'Ce nom est déjà pris');
    setSessionCookie(reply, user.id);
    notify.leaderboard();
    return reply.status(201).send(user);
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = parse(CredentialsSchema, req.body);
    const row = users.findByUsername(body.username);
    const locked = row ? users.lockRemaining(row) : 0;
    if (locked > 0) {
      const minutes = Math.ceil(locked / 60_000);
      throw new HttpError(429, 'LOCKED', `Trop d'essais. Réessaie dans ${minutes} min`);
    }
    // Always run scrypt so response time does not depend on the account existing.
    const ok = await verifyPassword(body.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      if (row) users.recordFailedLogin(row);
      throw new HttpError(401, 'BAD_CREDENTIALS', 'Code incorrect');
    }
    users.recordSuccessfulLogin(row.id);
    setSessionCookie(reply, row.id);
    return users.findById(row.id);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    sessions.revoke(req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => {
    const user = users.findById(requireUser(req));
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Connexion requise');
    return user;
  });

  app.get('/api/me/stats', async (req) => {
    const userId = requireUser(req);
    const stats = users.profileStats(userId, runs.get(userId).stats.goldEarned ?? 0);
    if (!stats) throw new HttpError(401, 'UNAUTHENTICATED', 'Connexion requise');
    return stats;
  });

  app.put('/api/me/avatar', async (req) => {
    const userId = requireUser(req);
    const { avatar } = parse(AvatarSchema, req.body);
    users.setAvatar(userId, avatar);
    notify.leaderboard();
    return users.findById(userId);
  });
}
