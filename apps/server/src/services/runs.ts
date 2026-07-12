import { randomInt } from 'node:crypto';
import { applyAction, createRun, MAX_PALIER, runMode, type ActionResult, type GameMode, type RunAction, type RunState } from '@autobattle/shared';
import { transaction, type Db } from '../db/index.js';
import type { InventoryService } from './inventory.js';
import type { UserService } from './users.js';

const newSeed = () => randomInt(0, 2 ** 32 - 1);

export interface RunActionOutcome extends ActionResult {
  newBest: boolean;
  casesGranted: number;
  /** Set when this action's victory unlocked a new difficulty tier. */
  palierUnlocked?: number;
}

/**
 * The server owns the run. The client only sends intents ("fight",
 * "chooseUpgrade 1"...) and animates the event log it receives back.
 */
export class RunService {
  constructor(
    private readonly db: Db,
    private readonly users: UserService,
    private readonly inventory: InventoryService,
  ) {}

  get(userId: number): RunState {
    const row = this.db.prepare('SELECT state FROM runs WHERE user_id = ?').get(userId) as { state: string } | undefined;
    if (row) return JSON.parse(row.state) as RunState;
    const run = createRun(newSeed(), Date.now());
    this.save(userId, run);
    return run;
  }

  act(userId: number, action: RunAction, now = Date.now()): RunActionOutcome {
    return transaction(this.db, () => {
      const previous = this.get(userId);
      const result = applyAction(previous, action, {
        ownedCardIds: this.inventory.ownedCardIds(userId),
        newSeed: newSeed(),
        maxPalier: this.users.palierUnlocked(userId),
        now,
      });
      const { state, fight } = result;

      const cases = fight?.reward?.cases ?? [];
      for (const drop of cases) this.inventory.grantCase(userId, drop.caseId, now);

      if (action.type === 'newRun' && previous.phase !== 'dead' && previous.level > 0) {
        this.archive(userId, previous, 'abandon', now);
      }
      if (state.phase === 'dead' && previous.phase !== 'dead') this.archive(userId, state, 'death', now);

      const newBest = state.level > previous.level && this.users.recordLevel(userId, state.level, runMode(state), now);
      // Winning on tier N opens tier N+1.
      const next = (state.palier ?? 1) + 1;
      const palierUnlocked = fight?.reward?.victory && this.users.unlockPalier(userId, next) ? Math.min(next, MAX_PALIER) : undefined;
      this.save(userId, state, now);
      return { ...result, newBest, casesGranted: cases.length, ...(palierUnlocked ? { palierUnlocked } : {}) };
    });
  }

  /** Current level and mode of the given users' runs, for the live leaderboard. */
  currentLevels(userIds: number[]): Map<number, { level: number; mode: GameMode }> {
    if (userIds.length === 0) return new Map();
    const rows = this.db
      .prepare(
        `SELECT user_id, json_extract(state, '$.level') AS level, COALESCE(json_extract(state, '$.mode'), 'deck') AS mode
         FROM runs WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
      )
      .all(...userIds) as { user_id: number; level: number; mode: GameMode }[];
    return new Map(rows.map((r) => [r.user_id, { level: r.level, mode: r.mode }]));
  }

  countActive(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM runs WHERE json_extract(state, '$.phase') != 'dead'`).get() as { n: number };
    return row.n;
  }

  private save(userId: number, state: RunState, now = Date.now()) {
    this.db
      .prepare(
        'INSERT INTO runs (user_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
      )
      .run(userId, JSON.stringify(state), now);
  }

  private archive(userId: number, state: RunState, reason: 'death' | 'abandon', now: number) {
    this.db
      .prepare(
        'INSERT INTO run_history (user_id, mode, palier, won, summary, level, kills, gold_earned, deck, started_at, ended_at, end_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(userId, runMode(state), state.palier ?? 1, state.won ? 1 : 0, JSON.stringify(summarize(state)), state.level, state.stats.kills, state.stats.goldEarned ?? 0, JSON.stringify(state.deck.map((d) => d.cardId)), state.startedAt, now, reason);
  }
}

/** What we keep of a finished run, to study balance on real games (see `npm run balance:history`). */
function summarize(state: RunState) {
  return {
    base: state.base,
    gold: state.gold,
    deck: state.deck.map((d) => ({ card: d.cardId, modifier: d.modifier })),
    perks: state.perks ?? [],
    forge: state.forge ?? 0,
    passives: state.bossPassives,
    facing: state.nextBoss ?? null,
    stats: state.stats,
  };
}
