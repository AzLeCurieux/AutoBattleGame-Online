import { simulateFight } from './combat.js';
import { Rng } from './rng.js';
import { nextBossAct } from './shop.js';
import { computeStats } from './stats.js';
import type { PublicRunState, RunState } from './types.js';

/**
 * Estimated chance to beat the announced boss with the current build, at full
 * HP. Pure and deterministic (fixed seeds), so the client can show it and the
 * balance bots can use the same number.
 */
export function bossOdds(run: PublicRunState | RunState, tries = 16): number {
  if ((run.mode ?? 'deck') !== 'deck' || !run.nextBoss) return 1;
  const act = nextBossAct(run);
  let wins = 0;
  for (let i = 0; i < tries; i++) {
    const copy = structuredClone({ ...run, rng: 0, level: act * 10 - 1, phase: 'ready' as const }) as RunState;
    copy.hp = computeStats(copy).maxHp;
    if (simulateFight(copy, new Rng(i * 7919 + 13)).outcome === 'victory') wins++;
  }
  return wins / tries;
}
