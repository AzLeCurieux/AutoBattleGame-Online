/**
 * Simulated players used to measure and calibrate balance. Three skill levels:
 * - novice: random choices, heals late, buys the first thing it can afford;
 * - average: sensible heuristics, no long-term planning;
 * - expert: plans for bosses, keeps gold for interest, upgrades its deck.
 */
import {
  applyAction,
  bossOdds,
  bossRerollPrice,
  forgePrice,
  nextBossAct,
  CARDS,
  CARDS_BY_ID,
  computeStats,
  createRun,
  healCost,
  MAX_ITEMS,
  MAX_STARS,
  nextEnemyKind,
  RARITIES,
  actOf,
  type GameMode,
  type RunAction,
  type RunState,
  type UpgradeOffer,
} from '../../src/index.js';

export type Skill = 'novice' | 'average' | 'expert';
export const ALL_CARDS = CARDS.map((c) => c.id);
export const STARTER_CARDS: string[] = [];

const rank = (cardId: string) => RARITIES.indexOf(CARDS_BY_ID.get(cardId)!.rarity);
/** Cheap deterministic noise so the novice is random but reproducible. */
const noise = (a: number, b: number) => {
  let t = (a * 2654435761 + b * 40503) >>> 0;
  t ^= t >>> 15;
  t = Math.imul(t, 2246822519) >>> 0;
  return (t ^ (t >>> 13)) / 4294967296 + 0.5;
};

/** Expected damage per hit: attack × average crit multiplier. */
const effective = (s: RunState) => {
  const st = computeStats(s);
  return st.attack * (1 + (st.critChance / 100) * (st.critDamage / 100));
};

/**
 * Expert scoring: applies the offer to a copy and measures the real gain in
 * expected damage and max HP — crit chance and crit damage multiply each other,
 * which is exactly what strong human players exploit.
 */
/** Camp, treasure and event offers: same for every skill except the novice (random). */
function stepScore(o: UpgradeOffer, s: RunState): number | null {
  const ratio = s.hp / computeStats(s).maxHp;
  switch (o.kind) {
    case 'heal':
      return (1 - ratio) * o.percent * 1.4;
    case 'item':
      return (s.items ?? []).length < MAX_ITEMS ? 9 : 1;
    case 'gamble':
      return o.gold / 2 - (ratio < 0.6 ? 25 : 6);
    case 'sacrifice':
      return ratio > 0.5 ? 14 : 2;
    case 'edition':
      return s.gold >= o.price + healCost(s) ? 15 : -100;
    case 'leave':
      return 0;
    default:
      return null;
  }
}

function expertScore(o: UpgradeOffer, s: RunState): number {
  const step = stepScore(o, s);
  if (step !== null) return step;
  if (o.kind === 'fullHeal') return (1 - s.hp / computeStats(s).maxHp) * 60;
  if (o.kind === 'gold') return 3 + o.value / 2;
  if (o.kind === 'bossPassive' && o.passive === 'greed') return 26 - actOf(s.level + 1) * 3;
  const t: RunState = { ...s, base: { ...s.base }, bossPassives: [...s.bossPassives] };
  if (o.kind === 'damage') t.base.damage += o.value;
  else if (o.kind === 'maxHp') t.base.maxHp += o.value;
  else if (o.kind === 'critChance') t.base.critChance += o.value;
  else if (o.kind === 'critDamage') t.base.critDamage += o.value;
  else if (o.kind === 'bossPassive' && o.passive === 'regen') return 22;
  else if (o.kind === 'bossPassive') t.bossPassives.push(o.passive);
  else return 0;
  const dmg = effective(t) / effective(s) - 1;
  const hp = computeStats(t).maxHp / computeStats(s).maxHp - 1;
  // Plan like a human: build crit chance toward the cap, then crit damage — the
  // greedy one-step gain undervalues how the two multiply later on.
  const cc = computeStats(s).critChance;
  const plan = o.kind === 'critChance' && cc < 60 ? 2.2 : o.kind === 'critDamage' && cc >= 30 ? 1.6 : 1;
  return dmg * 130 * plan + hp * 150;
}

function score(o: UpgradeOffer, s: RunState, expert = false): number {
  if (expert) return expertScore(o, s);
  const step = stepScore(o, s);
  if (step !== null) return step;
  const st = computeStats(s);
  // Experts know survival wins runs: they value max HP and Vitality much more.
  const hp = expert ? 1.9 : 1;
  switch (o.kind) {
    case 'damage':
      return (o.value / st.attack) * 120;
    case 'maxHp':
      return (o.value / st.maxHp) * 100 * hp;
    case 'fullHeal':
      return (1 - s.hp / st.maxHp) * 60;
    case 'gold':
      return 3 + o.value / 2;
    case 'critChance':
      return o.value * (st.critDamage / 100) * 1.1;
    case 'critDamage':
      return (o.value * st.critChance) / 100;
    case 'bossPassive':
      return { rage: 30, regen: 28, vitality: 22, fury: 26, bulwark: 24, greed: 18 }[o.passive];
    default:
      return 0;
  }
}

/** Route: which step to take next. */
function chooseNode(s: RunState, skill: Skill, rnd: (k: number) => number): number {
  const route = s.route!;
  if (skill === 'novice') return Math.floor(rnd(7) * route.length) % route.length;
  const ratio = s.hp / computeStats(s).maxHp;
  const expert = skill === 'expert';
  const value = (kind: string) => {
    switch (kind) {
      case 'fight':
        return 10;
      case 'elite':
        return ratio > (expert ? 0.65 : 0.8) ? 12 : 1;
      case 'camp':
        return (1 - ratio) * 32 + 3;
      case 'treasure':
        return 9;
      case 'event':
        return expert ? 8 : 6;
      case 'shop':
        return s.gold >= 15 ? 13 : 2;
      case 'skip':
        return ratio > 0.65 ? 4 : 11;
      default:
        return 0;
    }
  };
  return route.map((n, i) => [value(n.kind), i] as const).sort((a, b) => b[0] - a[0])[0]![1];
}

/** Items: potion when low, buffs before the hard fights, prism right away. */
function chooseItem(s: RunState, skill: Skill): number {
  if (skill === 'novice') return -1;
  const items = s.items ?? [];
  const ratio = s.hp / computeStats(s).maxHp;
  const kind = nextEnemyKind(s);
  const hard = kind !== 'normal' && !s.route;
  return items.findIndex(
    (it) =>
      (it === 'potion' && ratio < 0.45) ||
      (it === 'prism' && s.deck.some((d) => !d.modifier)) ||
      ((it === 'whetstone' || it === 'shield') && hard && !(s.buffs ?? {})[it === 'whetstone' ? 'damage' : 'shield']) ||
      (it === 'luckyCoin' && !s.route && !(s.buffs ?? {}).gold),
  );
}

/** Quick estimate of the chance to beat the announced boss at full HP. */
export { bossOdds };

function decide(s: RunState, skill: Skill, step: number): RunAction {
  const rnd = (k: number) => noise(s.rng + step, k);
  const st = computeStats(s);

  if (s.phase === 'upgrade') {
    const offers = s.offer!;
    if (skill === 'novice') {
      const ok = offers.map((o, i) => ({ o, i })).filter(({ o }) => o.kind !== 'edition' || s.gold >= o.price);
      return { type: 'chooseUpgrade', index: ok[Math.floor(rnd(1) * ok.length) % ok.length]!.i };
    }
    const best = offers.map((o, i) => [score(o, s, skill === 'expert'), i] as const).sort((a, b) => b[0] - a[0])[0]![1];
    return { type: 'chooseUpgrade', index: best };
  }

  if (s.phase === 'pack') {
    const pack = s.pack!;
    const free = st.emptySlots > 0;
    const options = pack.options
      .map((o, i) => ({ o, i }))
      .filter(({ o, i }) => {
        if (pack.taken.includes(i)) return false;
        if (o.type === 'stat') return true;
        const owned = s.deck.find((d) => d.cardId === o.cardId);
        return owned ? (owned.stars ?? 1) < MAX_STARS : free;
      });
    if (options.length === 0) return { type: 'packSkip' };
    if (skill === 'novice') return { type: 'packPick', index: options[0]!.i };
    const value = ({ o }: (typeof options)[number]) => (o.type === 'stat' ? score(o.offer, s, skill === 'expert') : 10 + rank(o.cardId) * 6 + (o.modifier ? 4 : 0));
    return { type: 'packPick', index: options.sort((a, b) => value(b) - value(a))[0]!.i };
  }

  if (s.phase === 'shop') {
    const shop = s.shop!;
    // Always keep a heal in hand; the expert also keeps enough to earn interest.
    const reserve = skill === 'novice' ? 0 : healCost(s);
    const spendable = s.gold - reserve;
    const cards = shop.cards.map((it, i) => ({ it, i })).filter(({ it }) => !it.sold && !s.deck.some((d) => d.cardId === it.cardId));
    const fusions = shop.cards.map((it, i) => ({ it, i })).filter(({ it }) => !it.sold && s.deck.some((d) => d.cardId === it.cardId && (d.stars ?? 1) < MAX_STARS));
    const free = st.emptySlots > 0;

    if (skill === 'novice') {
      const c = cards.find(({ it }) => it.price <= s.gold);
      if (c && free && rnd(2) < 0.7) return { type: 'shopBuy', index: c.i };
      const p = shop.packs.findIndex((x) => !x.sold && x.price <= s.gold);
      if (p >= 0 && rnd(3) < 0.5) return { type: 'shopBuyPack', index: p };
      return { type: 'shopLeave' };
    }

    // The expert stops buying economy perks once the run is under way: raw power wins late.
    const perkWorth = skill !== 'expert' || nextBossAct(s) <= 4 || ['satchel', 'stuffedPacks', 'flair'].includes(shop.perk?.perk ?? '');
    if (shop.perk && !shop.perk.sold && shop.perk.price <= spendable && perkWorth) return { type: 'shopBuyPerk' };
    const fuse = fusions.find(({ it }) => it.price <= spendable && rank(it.cardId) >= 2);
    if (fuse) return { type: 'shopBuy', index: fuse.i };
    if (skill === 'expert' && shop.item && !shop.item.sold && shop.item.price <= spendable - 4 && (s.items ?? []).length < MAX_ITEMS) return { type: 'shopBuyItem' };
    const best = cards.filter(({ it }) => it.price <= spendable).sort((a, b) => rank(b.it.cardId) - rank(a.it.cardId))[0];
    if (best && free) return { type: 'shopBuy', index: best.i };
    if (best && skill === 'expert') {
      // Deck full: swap the weakest card for a clearly better one.
      const weakest = s.deck.map((d, i) => ({ r: rank(d.cardId), i })).sort((a, b) => a.r - b.r)[0]!;
      if (rank(best.it.cardId) >= weakest.r + 2) return { type: 'shopSell', index: weakest.i };
    }
    const pack = shop.packs.map((p, i) => ({ p, i })).find(({ p }) => !p.sold && p.price <= spendable && (free || p.kind === 'training'));
    if (pack) return { type: 'shopBuyPack', index: pack.i };
    // Expert: swap a boss that counters the build (checked once per shop visit).
    if (skill === 'expert' && s.bossRerollAct !== nextBossAct(s) && bossRerollPrice(s) <= spendable && step % 2 === 0 && bossOdds(s) < 0.5) {
      return { type: 'bossReroll' };
    }
    // Surplus gold goes into the Forge (the expert keeps more for interest).
    const keep = skill === 'expert' ? 0 : 10;
    if (s.gold - forgePrice(s) >= keep + healCost(s)) return { type: 'shopForge' };
    if (skill === 'expert' && free && shop.rerollCost <= spendable - 6 && shop.rerollCost <= 3) return { type: 'shopReroll' };
    return { type: 'shopLeave' };
  }

  // phase 'ready': items, route, heal or fight
  const item = chooseItem(s, skill);
  if (item >= 0) return { type: 'useItem', index: item };
  if (s.route) return { type: 'chooseNode', index: chooseNode(s, skill, rnd) };
  const ratio = s.hp / st.maxHp;
  const kind = nextEnemyKind(s);
  const threshold = skill === 'novice' ? 0.25 : skill === 'average' ? (kind === 'normal' ? 0.45 : 0.6) : kind === 'normal' ? 0.4 : kind === 'elite' ? 0.6 : 0.75;
  if (ratio < threshold && s.gold >= healCost(s)) return { type: 'heal' };
  return { type: 'fight' };
}

export interface SimOptions {
  skill: Skill;
  mode: GameMode;
  owned: readonly string[];
  /** Stop once this level is reached (default: play until death). */
  untilLevel?: number;
  maxSteps?: number;
}

export interface Trace {
  /** Player hits and share of max HP lost, per fight. */
  fights: { stage: number; kind: string; hits: number; hpLost: number; won: boolean }[];
}

/** Plays `state` forward. Returns the final state (dead, or at `untilLevel`). */
export function advance(state: RunState, opts: SimOptions, trace?: Trace): RunState {
  let s = state;
  const ctx = { ownedCardIds: opts.owned, newSeed: 1, now: 0 };
  for (let step = 0; step < (opts.maxSteps ?? 6000); step++) {
    if (s.phase === 'dead') break;
    if (opts.untilLevel !== undefined && s.level >= opts.untilLevel && s.phase === 'ready') break;
    const action = decide(s, opts.skill, step);
    const before = s;
    const result = applyAction(s, action, ctx);
    s = result.state;
    if (trace && result.fight) {
      const max = computeStats(before, result.fight.enemy.stage).maxHp;
      const endHp = result.fight.events.at(-1)?.playerHp ?? before.hp;
      trace.fights.push({
        stage: result.fight.enemy.stage,
        kind: result.fight.enemy.kind,
        hits: result.fight.events.filter((e) => e.type === 'hit' && e.by === 'player').length,
        hpLost: (before.hp - endHp) / max,
        won: result.fight.outcome === 'victory',
      });
    }
  }
  return s;
}

export const seedOf = (i: number) => 1000 + i * 7919;
export const newRuns = (n: number, mode: GameMode) => Array.from({ length: n }, (_, i) => createRun(seedOf(i), 0, mode));
