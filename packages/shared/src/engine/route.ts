import { RULES, actOf, stageKind, type EnemyKind } from '../rules.js';
import type { Rng } from './rng.js';
import type { ItemId, NodeKind, RouteNode, RunState, UpgradeOffer } from './types.js';
import { ITEM_IDS } from './types.js';

/**
 * Route of an act (deck mode). An act is still 10 steps (the "level" counts
 * steps), but most of them are chosen among 2-3 options:
 * - step 1: a fight (warm-up);
 * - step 5: the elite, or skip it for an item;
 * - step 10: the boss;
 * - the others: fight, elite, camp, event, treasure or (once per act) a shop.
 * Fights give the level-up pick and gold; the other steps trade that for HP,
 * items, gold or a gamble.
 */

/** Position of the next step inside its act, 1..10. */
export const stepOf = (level: number) => (level % RULES.acts.length) + 1;

const WEIGHTS: [NodeKind, number][] = [
  ['fight', 30],
  ['elite', 12],
  ['camp', 18],
  ['event', 20],
  ['treasure', 12],
  ['shop', 8],
];

/** Options offered for the next step, or null when it is forced (first step, boss). */
export function rollRoute(state: RunState, rng: Rng): RouteNode[] | null {
  const step = stepOf(state.level);
  if (step === 1 || step === RULES.acts.length) return null;
  if (step === RULES.acts.eliteAt) return [{ kind: 'elite' }, { kind: 'skip', item: rng.pick(ITEM_IDS) }];
  const taken = state.path ?? [];
  const shopTaken = taken.includes('shop');
  // At least one fight among the options, so a player can always level up.
  const options: RouteNode[] = [{ kind: 'fight' }];
  const count = rng.chance(35) ? 3 : 2;
  while (options.length < count) {
    const pool = WEIGHTS.filter(([k]) => !options.some((o) => o.kind === k) && !(k === 'shop' && (shopTaken || step < 3)));
    const kind = weighted(rng, pool);
    options.push(kind === 'treasure' ? { kind, item: rng.pick(ITEM_IDS) } : { kind });
  }
  return rng.sample(options, options.length);
}

function weighted(rng: Rng, pool: [NodeKind, number][]): NodeKind {
  let roll = rng.next() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of pool) {
    roll -= w;
    if (roll < 0) return k;
  }
  return pool[pool.length - 1]![0];
}

/** Forced node of the next step (when there is no choice). */
export function forcedNode(level: number): NodeKind | null {
  const step = stepOf(level);
  return step === 1 ? 'fight' : step === RULES.acts.length ? 'boss' : null;
}

export const isFightNode = (n: NodeKind | null | undefined) => n === 'fight' || n === 'elite' || n === 'boss';

/** Kind of the next enemy: chosen on the route in deck mode, fixed by the stage in classic. */
export function nextEnemyKind(state: Pick<RunState, 'level' | 'mode' | 'node'>): EnemyKind {
  const mode = state.mode ?? 'deck';
  // The act's frame is fixed (elite at 5, boss at 10); an elite picked elsewhere on the route is an elite too.
  if (mode === 'deck' && state.node === 'elite') return 'elite';
  return stageKind(state.level + 1, mode);
}

/** What a non-fight step offers (shown like the level-up choice). */
export function nodeOffers(state: RunState, node: NodeKind, rng: Rng, item?: ItemId): UpgradeOffer[] {
  const act = actOf(state.level + 1);
  switch (node) {
    case 'camp':
      return [
        { kind: 'heal', percent: 45 },
        { kind: 'damage', value: rng.int(30, 50) + act * 10 },
        { kind: 'maxHp', value: rng.int(90, 140) + act * 25 },
      ];
    case 'treasure':
      return [
        { kind: 'gold', value: 6 + act * 2 },
        { kind: 'item', item: item ?? rng.pick(ITEM_IDS) },
      ];
    case 'event': {
      const pool: UpgradeOffer[] = [
        { kind: 'gamble', hpPercent: 25, gold: 10 + act * 3 },
        { kind: 'sacrifice', hpPercent: 12 },
        { kind: 'item', item: rng.pick(ITEM_IDS) },
      ];
      if (state.deck.some((d) => !d.modifier)) pool.push({ kind: 'edition', price: 6 + act });
      return [...rng.sample(pool, 2), { kind: 'leave' }];
    }
    default:
      return [];
  }
}
