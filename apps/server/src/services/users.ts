import { DEFAULT_AVATAR, MAX_PALIER, type Avatar, type GameMode, type ProfileListEntry, type ProfileStats, type PublicUser } from '@autobattle/shared';
import type { Db } from '../db/index.js';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  has_pin: number;
  avatar: Avatar;
  role: 'player' | 'admin';
  best_level: number;
  created_at: number;
  last_login_at: number | null;
  failed_logins: number;
  lock_count: number;
  locked_until: number | null;
}

/** After this many wrong answers the account is locked; each new lock doubles. */
export const MAX_FAILED_LOGINS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

export class UserService {
  constructor(private readonly db: Db) {}

  findByUsername(username: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  }

  findById(id: number): PublicUser | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? toPublicUser(row) : undefined;
  }

  /** Returns null when the username is taken. */
  create(username: string, passwordHash: string, isPin: boolean, now = Date.now()): PublicUser | null {
    try {
      const { lastInsertRowid } = this.db
        .prepare(
          'INSERT INTO users (username, password_hash, has_pin, avatar, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(username, passwordHash, isPin ? 1 : 0, DEFAULT_AVATAR, now, now);
      return this.findById(Number(lastInsertRowid))!;
    } catch (err) {
      if (err instanceof Error && /UNIQUE/.test(err.message)) return null;
      throw err;
    }
  }

  /** Profiles shown on the "Qui joue aujourd'hui ?" screen. */
  listProfiles(limit = 100): ProfileListEntry[] {
    const rows = this.db
      .prepare('SELECT username, avatar, has_pin FROM users ORDER BY last_login_at DESC NULLS LAST, id LIMIT ?')
      .all(limit) as { username: string; avatar: Avatar; has_pin: number }[];
    return rows.map((r) => ({ username: r.username, avatar: r.avatar, hasPin: r.has_pin === 1 }));
  }

  /** Remaining lock time in ms, 0 when the account can be tried. */
  lockRemaining(row: UserRow, now = Date.now()): number {
    return row.locked_until && row.locked_until > now ? row.locked_until - now : 0;
  }

  recordFailedLogin(row: UserRow, now = Date.now()) {
    const failed = row.failed_logins + 1;
    if (failed < MAX_FAILED_LOGINS) {
      this.db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(failed, row.id);
      return;
    }
    const lockMs = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** row.lock_count);
    this.db
      .prepare('UPDATE users SET failed_logins = 0, lock_count = lock_count + 1, locked_until = ? WHERE id = ?')
      .run(now + lockMs, row.id);
  }

  recordSuccessfulLogin(id: number, now = Date.now()) {
    this.db
      .prepare('UPDATE users SET last_login_at = ?, failed_logins = 0, lock_count = 0, locked_until = NULL WHERE id = ?')
      .run(now, id);
  }

  setAvatar(id: number, avatar: Avatar) {
    this.db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, id);
  }

  /** Records a new personal best for that mode. Returns true when it improved. */
  recordLevel(id: number, level: number, mode: GameMode = 'deck', now = Date.now()): boolean {
    const [col, at] = mode === 'classic' ? ['best_level_classic', 'best_level_classic_at'] : ['best_level', 'best_level_at'];
    const { changes } = this.db
      .prepare(`UPDATE users SET ${col} = ?, ${at} = ? WHERE id = ? AND ${col} < ?`)
      .run(level, now, id, level);
    return Number(changes) > 0;
  }

  palierUnlocked(id: number): number {
    return (this.db.prepare('SELECT palier_unlocked AS v FROM users WHERE id = ?').get(id) as { v: number } | undefined)?.v ?? 1;
  }

  /** Raises the unlocked tier; returns true when it actually went up. */
  unlockPalier(id: number, palier: number): boolean {
    const p = Math.min(MAX_PALIER, palier);
    return this.db.prepare('UPDATE users SET palier_unlocked = ? WHERE id = ? AND palier_unlocked < ?').run(p, id, p).changes > 0;
  }

  bestLevel(id: number, mode: GameMode): number {
    const col = mode === 'classic' ? 'best_level_classic' : 'best_level';
    return (this.db.prepare(`SELECT ${col} AS v FROM users WHERE id = ?`).get(id) as { v: number } | undefined)?.v ?? 0;
  }

  profileStats(id: number, currentRunGold: number): ProfileStats | undefined {
    const row = this.db
      .prepare(
        `SELECT u.best_level, u.best_level_classic, u.created_at, u.last_login_at, u.palier_unlocked,
                (SELECT COUNT(*) FROM run_history h WHERE h.user_id = u.id) AS games,
                (SELECT COUNT(*) FROM run_history h WHERE h.user_id = u.id AND h.won = 1) AS wins,
                (SELECT COALESCE(SUM(gold_earned), 0) FROM run_history h WHERE h.user_id = u.id) AS gold,
                (SELECT COUNT(*) FROM user_cases c WHERE c.user_id = u.id) AS cases
         FROM users u WHERE u.id = ?`,
      )
      .get(id) as
      | {
          best_level: number;
          best_level_classic: number;
          created_at: number;
          last_login_at: number | null;
          palier_unlocked: number;
          games: number;
          wins: number;
          gold: number;
          cases: number;
        }
      | undefined;
    if (!row) return undefined;
    return {
      bestLevel: row.best_level,
      bestLevelClassic: row.best_level_classic,
      totalGold: row.gold + currentRunGold,
      gamesPlayed: row.games,
      wins: row.wins,
      palierUnlocked: row.palier_unlocked,
      casesFound: row.cases,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  setRole(username: string, role: 'player' | 'admin'): boolean {
    const { changes } = this.db.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username);
    return Number(changes) > 0;
  }
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, username: row.username, avatar: row.avatar, role: row.role, bestLevel: row.best_level };
}
