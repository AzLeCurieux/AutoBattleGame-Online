import { RULES, actOf, stageKind, type EnemyKind } from '../rules.js';
import { getCard } from '../cards.js';
import { describeEffect } from '../effects.js';
import type { Rng } from './rng.js';
import { starred } from './stats.js';
import type { ItemId, NodeKind, PathTheme, RouteNode, RoutePath, RunState, UpgradeOffer } from './types.js';
import { ITEM_IDS } from './types.js';

/**
 * Route of an act (deck mode). An act is still 10 steps (the "level" counts
 * steps). Step 1 is a fight and step 10 the boss; three times per act — before
 * steps 2, 5 and 8 — the player picks a themed path for the next 3, 3 and 2
 * steps, which then play on their own. Few interruptions, real choices.
 */

/** Position of the next step inside its act, 1..10. */
export const stepOf = (level: number) => (level % RULES.acts.length) + 1;

/** Junctions: step where a path starts → how many steps the path covers. */
const JUNCTIONS: Record<number, number> = { 2: 3, 5: 3, 8: 2 };

export const isJunction = (level: number) => stepOf(level) in JUNCTIONS;

const THEMES: Record<Exclude<PathTheme, 'challenge' | 'bypass'>, NodeKind[]> = {
  battle: ['fight', 'fight', 'fight'],
  calm: ['fight', 'camp', 'treasure'],
  mystery: ['event', 'fight', 'event'],
  market: ['fight', 'shop', 'treasure'],
};

/** Paths for the junction at the next step, or null when the next step is not a junction. */
export function rollRoute(state: RunState, rng: Rng): RoutePath[] | null {
  const step = stepOf(state.level);
  const length = JUNCTIONS[step];
  if (!length) return null;
  const shopTaken = (state.path ?? []).includes('shop');
  const node = (kind: NodeKind): RouteNode => (kind === 'treasure' || kind === 'skip' ? { kind, item: rng.pick(ITEM_IDS) } : { kind });
  const path = (theme: PathTheme, kinds: NodeKind[]): RoutePath => ({ theme, steps: kinds.slice(0, length).map(node) });

  if (step === RULES.acts.eliteAt) {
    // The elite junction: face it, or go around it for an item.
    const tails: NodeKind[][] = [
      ['fight', 'camp'],
      ['event', 'fight'],
      ['fight', 'treasure'],
    ];
    const [a, b] = rng.sample(tails, 2);
    return [path('challenge', ['elite', ...a!]), path('bypass', ['skip', ...b!])];
  }

  const pool = (Object.keys(THEMES) as (keyof typeof THEMES)[]).filter((t) => !(t === 'market' && shopTaken));
  const themes = rng.sample(pool, rng.chance(40) ? 3 : 2);
  // Last junction before the boss: two steps, the second one leans towards rest.
  return themes.map((t) => path(t, length === 2 ? lastLeg(t) : THEMES[t]));
}

function lastLeg(theme: keyof typeof THEMES): NodeKind[] {
  return { battle: ['fight', 'fight'], calm: ['treasure', 'camp'], mystery: ['event', 'camp'], market: ['shop', 'camp'] }[theme] as NodeKind[];
}

/** Forced node of the next step: first fight, boss, or a plain fight when nothing is planned (old saves). */
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

/** Text of a card at a level, effect by effect (for the camp's "before → after"). */
export function cardLines(cardId: string, level: number): string[] {
  const card = getCard(cardId);
  return card ? card.effects.map((e) => describeEffect(starred(e, level))) : [];
}

/** What a non-fight step offers (shown like the level-up choice). */
export function nodeOffers(state: RunState, node: NodeKind, rng: Rng, item?: ItemId | null): UpgradeOffer[] {
  const act = actOf(state.level + 1);
  switch (node) {
    case 'camp': {
      // Rest, train, or raise one of the deck's cards to the next level.
      const offers: UpgradeOffer[] = [{ kind: 'heal', percent: 45 }];
      const levels = state.deck.map((d, index) => ({ d, index })).filter(({ d }) => (d.stars ?? 1) < 3);
      for (const { d, index } of rng.sample(levels, 2)) offers.push({ kind: 'cardLevel', index, cardId: d.cardId, level: (d.stars ?? 1) + 1 });
      const stats: UpgradeOffer[] = [
        { kind: 'damage', value: rng.int(30, 50) + act * 10 },
        { kind: 'maxHp', value: rng.int(90, 140) + act * 25 },
      ];
      offers.push(...rng.sample(stats, offers.length >= 3 ? 1 : 2));
      return offers;
    }
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
