import type { Avatar, GameMode, LeaderboardEntry, LeaderboardSnapshot } from '@autobattle/shared';
import type { Db } from '../db/index.js';
import type { RunService } from './runs.js';

/**
 * Leaderboard = one indexed query on users.best_level, which the server
 * updates itself. Replaces the old "DELETE + rebuild the whole table with
 * correlated sub-queries every 10 seconds" approach.
 */
export class LeaderboardService {
  private readonly online = new Map<number, number>();

  constructor(
    private readonly db: Db,
    private readonly runs: RunService,
  ) {}

  connect(userId: number) {
    this.online.set(userId, (this.online.get(userId) ?? 0) + 1);
  }

  disconnect(userId: number) {
    const n = (this.online.get(userId) ?? 1) - 1;
    if (n <= 0) this.online.delete(userId);
    else this.online.set(userId, n);
  }

  onlineCount(): number {
    return this.online.size;
  }

  private top(mode: GameMode, limit: number): LeaderboardEntry[] {
    const [col, at] = mode === 'classic' ? ['best_level_classic', 'best_level_classic_at'] : ['best_level', 'best_level_at'];
    const rows = this.db
      .prepare(
        `SELECT u.id, u.username, u.avatar, u.${col} AS best,
                (SELECT COUNT(*) FROM run_history h WHERE h.user_id = u.id AND h.mode = ?) AS games,
                (SELECT COUNT(*) FROM run_history h WHERE h.user_id = u.id AND h.mode = 'deck' AND h.won = 1) AS wins,
                u.palier_unlocked - 1 AS palier_won
         FROM users u ORDER BY u.${col} DESC, u.${at} ASC NULLS LAST, u.id LIMIT ?`,
      )
      .all(mode, limit) as { id: number; username: string; avatar: Avatar; best: number; games: number; wins: number; palier_won: number }[];
    return rows.map((r) => ({
      userId: r.id,
      username: r.username,
      avatar: r.avatar,
      bestLevel: r.best,
      gamesPlayed: r.games,
      wins: mode === 'deck' ? r.wins : 0,
      palierWon: mode === 'deck' ? r.palier_won : 0,
    }));
  }

  snapshot(limit = 10): LeaderboardSnapshot {
    const onlineIds = [...this.online.keys()];
    const onlineRows = onlineIds.length
      ? (this.db
          .prepare(`SELECT id, username, avatar FROM users WHERE id IN (${onlineIds.map(() => '?').join(',')}) ORDER BY username`)
          .all(...onlineIds) as { id: number; username: string; avatar: Avatar }[])
      : [];
    const current = this.runs.currentLevels(onlineIds);
    return {
      top: { deck: this.top('deck', limit), classic: this.top('classic', limit) },
      online: onlineRows.map((r) => ({
        userId: r.id,
        username: r.username,
        avatar: r.avatar,
        currentLevel: current.get(r.id)?.level ?? 0,
        mode: current.get(r.id)?.mode ?? 'deck',
      })),
    };
  }
}
