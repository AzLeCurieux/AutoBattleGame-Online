import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/index.js';

export const SESSION_COOKIE = 'sid';
const DAY = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Opaque random session tokens, stored hashed in SQLite. Unlike the old
 * in-memory Map + JWT combo, sessions survive restarts, can be revoked, and a
 * stolen database does not leak usable tokens.
 */
export class SessionStore {
  constructor(
    private readonly db: Db,
    private readonly ttlDays: number,
  ) {}

  create(userId: number, now = Date.now()): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + this.ttlDays * DAY;
    this.db
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), userId, now, expiresAt);
    return { token, expiresAt };
  }

  /** Returns the user id for a valid token, sliding the expiry forward when past half-life. */
  resolve(token: string | undefined, now = Date.now()): number | null {
    if (!token || token.length > 100) return null;
    const hash = hashToken(token);
    const row = this.db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(hash) as
      | { user_id: number; expires_at: number }
      | undefined;
    if (!row) return null;
    if (row.expires_at <= now) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
      return null;
    }
    if (row.expires_at - now < (this.ttlDays * DAY) / 2) {
      this.db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(now + this.ttlDays * DAY, hash);
    }
    return row.user_id;
  }

  revoke(token: string | undefined) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  purgeExpired(now = Date.now()) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  }
}

export function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
