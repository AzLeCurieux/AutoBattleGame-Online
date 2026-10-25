/* eslint-disable no-console -- CLI tool */
/**
 * Calibrates ACT_SCALE (enemy power per act, deck mode).
 *
 *   npm run balance:calibrate
 *
 * For each act, in order, it searches the enemy scale at which the reference
 * player (expert skill, full collection) clears the act at the target rate.
 * Runs that reached the act are cached, so only that act is re-simulated.
 * Paste the printed table into packages/shared/src/rules.ts.
 */
import { ACT_SCALE, RULES } from '../../src/index.js';
import { advance, ALL_CARDS, newRuns, type SimOptions } from './bot.js';

/**
 * Chance to clear act N for a run that reached it, for the reference player:
 * an EXPERT with the full collection. Product ≈ 17 % full wins — early acts stay
 * welcoming, each later act is a real but fair test.
 */
export const TARGET_CLEAR = [0.95, 0.88, 0.81, 0.74, 0.67, 0.61, 0.55, 0.5];

const N = Number(process.env.N ?? 3000);
const opts: SimOptions = { skill: 'expert', mode: 'deck', owned: ALL_CARDS };

let alive = newRuns(N, 'deck');
for (let act = 1; act <= RULES.acts.winAct; act++) {
  const target = TARGET_CLEAR[act - 1]!;
  const prev = act === 1 ? 1 : ACT_SCALE[act - 2]!;
  let lo = act === 1 ? 0.5 : prev;
  let hi = prev * 12;
  let survivors = alive;
  for (let iter = 0; iter < 14; iter++) {
    const mid = Math.sqrt(lo * hi);
    ACT_SCALE[act - 1] = mid;
    survivors = alive.map((s) => advance(s, { ...opts, untilLevel: act * RULES.acts.length })).filter((s) => s.phase !== 'dead');
    if (survivors.length / alive.length > target) lo = mid;
    else hi = mid;
  }
  ACT_SCALE[act - 1] = Number(Math.sqrt(lo * hi).toPrecision(3));
  survivors = alive.map((s) => advance(s, { ...opts, untilLevel: act * RULES.acts.length })).filter((s) => s.phase !== 'dead');
  console.log(`acte ${act}: échelle ${ACT_SCALE[act - 1]}  réussite ${(100 * survivors.length / alive.length).toFixed(1)} % (cible ${target * 100} %)  ${survivors.length}/${alive.length} parties`);
  alive = survivors;
}
console.log(`\nexport const ACT_SCALE: number[] = [${ACT_SCALE.join(', ')}];`);
