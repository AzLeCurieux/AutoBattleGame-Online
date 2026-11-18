import { describe, expect, it } from 'vitest';
import {
  CARDS,
  CASE_TYPES,
  GameRuleError,
  Rng,
  applyAction,
  computeStats,
  deckEffects,
  createEnemy,
  createRun,
  passivePower,
  stageKind,
  isFactorialNumber,
  isLucasNumber,
  rarityOdds,
  rollCase,
  simulateFight,
  type RunAction,
  type RunState,
  RULES,
  eliteBoss,
} from '../src/index.js';

const ctx = { ownedCardIds: [] as string[], newSeed: 42, now: 0 };

/** Deck mode: when the route offers a choice, take the fight (or the elite). */
function takeFight(s: RunState): RunState {
  if (!s.route) return s;
  const i = s.route.findIndex((n) => n.kind === 'fight' || n.kind === 'elite');
  return applyAction(s, { type: 'chooseNode', index: i }, ctx).state;
}

function play(state: RunState, actions: RunAction[]) {
  let s = state;
  for (const a of actions) s = applyAction(s, a, ctx).state;
  return s;
}

describe('catalog', () => {
  it('has unique card ids and descriptions for every card', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) expect(c.description.length).toBeGreaterThan(3);
  });

  it('normalises case odds to exactly 1', () => {
    for (const c of CASE_TYPES) {
      const total = Object.values(rarityOdds(c)).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('rolls roughly the advertised rarity distribution', () => {
    const rng = new Rng(1);
    const alpha = CASE_TYPES[0]!;
    const counts: Record<string, number> = {};
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const card = rollCase(alpha, () => rng.next());
      counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    }
    expect((counts.consumer ?? 0) / n).toBeCloseTo(rarityOdds(alpha).consumer, 1);
  });
});

describe('sequences', () => {
  it('detects Lucas and factorial numbers', () => {
    expect([1, 2, 3, 4, 7, 11, 18, 29].every(isLucasNumber)).toBe(true);
    expect([5, 6, 8, 10].some(isLucasNumber)).toBe(false);
    expect([1, 2, 6, 24, 120].every(isFactorialNumber)).toBe(true);
    expect([3, 5, 7, 25].some(isFactorialNumber)).toBe(false);
  });
});

describe('enemies', () => {
  it('spawns a boss every 5 stages with doubled HP', () => {
    expect(createEnemy(3).isBoss).toBe(false);
    const boss = createEnemy(4);
    expect(boss.isBoss).toBe(true);
    expect(boss.stage).toBe(5);
    expect(boss.maxHp).toBe(2 * Math.floor(400 + 40 * Math.pow(1.05, 4)));
  });
});

describe('run engine', () => {
  it('is deterministic for a given seed', () => {
    const a = applyAction(createRun(123, 0), { type: 'fight' }, ctx);
    const b = applyAction(createRun(123, 0), { type: 'fight' }, ctx);
    expect(a.fight).toEqual(b.fight);
    expect(a.state).toEqual(b.state);
  });

  it('never mutates the input state', () => {
    const start = createRun(5, 0);
    const copy = structuredClone(start);
    applyAction(start, { type: 'fight' }, ctx);
    expect(start).toEqual(copy);
  });

  it('wins the first fight with base stats and offers 2 upgrades', () => {
    const { state, fight } = applyAction(createRun(7, 0), { type: 'fight' }, ctx);
    expect(fight?.outcome).toBe('victory');
    expect(state.level).toBe(1);
    expect(state.gold).toBe(1);
    expect(state.phase).toBe('upgrade');
    expect(state.offer).toHaveLength(2);
  });

  it('rejects actions in the wrong phase', () => {
    expect(() => applyAction(createRun(7, 0), { type: 'chooseUpgrade', index: 0 }, ctx)).toThrow(GameRuleError);
    expect(() => applyAction(createRun(7, 0), { type: 'shopBuy', index: 0 }, ctx)).toThrow(GameRuleError);
  });

  it('rejects healing without gold', () => {
    const s = { ...createRun(7, 0), hp: 10 };
    expect(() => applyAction(s, { type: 'heal' }, ctx)).toThrow(/Or insuffisant/);
  });

  it('grants cases on level 3 and opens the shop once per act, after the boss, with interest', () => {
    let s = { ...createRun(99, 0), gold: 20 };
    let sawCases = false;
    for (let i = 0; i < 10; i++) {
      s = takeFight({ ...s, hp: computeStats(s).maxHp, base: { ...s.base, damage: 100000 } });
      const r = applyAction(s, { type: 'fight' }, ctx);
      if (r.fight?.reward?.cases.length) sawCases = true;
      s = applyAction(r.state, { type: 'chooseUpgrade', index: 0 }, ctx).state;
      if (s.level === 5) expect(s.phase).toBe('ready'); // no shop after the elite any more
    }
    expect(sawCases).toBe(true);
    expect(s.level).toBe(10);
    expect(s.phase).toBe('shop');
    expect(s.shop!.cards).toHaveLength(2);
    expect(s.shop!.packs).toHaveLength(2);
    expect(s.shop!.perk).not.toBeNull();
    expect(s.shop!.interest).toBeGreaterThan(0);
  });

  it('classic mode never opens the shop and keeps its mode on new runs', () => {
    let s = createRun(99, 0, 'classic');
    for (let i = 0; i < 10; i++) {
      s = { ...s, hp: computeStats(s).maxHp, base: { ...s.base, damage: 100000 } };
      s = applyAction(s, { type: 'fight' }, ctx).state;
      s = applyAction(s, { type: 'chooseUpgrade', index: 0 }, ctx).state;
    }
    expect(s.level).toBe(10);
    expect(s.phase).toBe('ready');
    expect(s.deck).toHaveLength(0);
    expect(play(s, [{ type: 'newRun' }]).mode).toBe('classic');
    expect(play(s, [{ type: 'newRun', mode: 'deck' }]).mode).toBe('deck');
  });

  const shopRun = (over: Partial<RunState> = {}, shop: Partial<NonNullable<RunState['shop']>> = {}): RunState => ({
    ...createRun(1, 0),
    phase: 'shop',
    gold: 30,
    shop: { cards: [], packs: [], perk: null, rerollCost: 2, interest: 0, ...shop },
    ...over,
  });

  it('buys and sells shop cards with server-side gold checks', () => {
    const start = shopRun({ gold: 10 }, { cards: [{ cardId: 'iut', modifier: null, price: 4, sold: false }] });
    const bought = applyAction(start, { type: 'shopBuy', index: 0 }, ctx).state;
    expect(bought.gold).toBe(6);
    expect(bought.deck.map((d) => d.cardId)).toEqual(['iut']);
    expect(computeStats(bought).maxHp).toBe(1200);
    expect(() => applyAction(bought, { type: 'shopBuy', index: 0 }, ctx)).toThrow(/déjà acheté/);

    const sold = applyAction(bought, { type: 'shopSell', index: 0 }, ctx).state;
    expect(sold.deck).toHaveLength(0);
    expect(sold.gold).toBe(6 + 2);
  });

  it('enforces the deck limit, extended by Negative cards and the Satchel perk', () => {
    const deck = ['complet', 'iut', 'gagou_fornite', 'glamal_csgo', 'ibra_kart'].map((cardId) => ({ cardId, modifier: null, price: 1 }));
    const plain = shopRun({ deck }, { cards: [{ cardId: 'axel_batman', modifier: null, price: 5, sold: false }] });
    expect(() => applyAction(plain, { type: 'shopBuy', index: 0 }, ctx)).toThrow(/Deck complet/);
    const negative = shopRun({ deck }, { cards: [{ cardId: 'axel_batman', modifier: 'negative', price: 15, sold: false }] });
    expect(applyAction(negative, { type: 'shopBuy', index: 0 }, ctx).state.deck).toHaveLength(6);
    const satchel = { ...plain, perks: ['satchel' as const] };
    expect(applyAction(satchel, { type: 'shopBuy', index: 0 }, ctx).state.deck).toHaveLength(6);
  });

  it('rerolls cards with a growing price, the first one free with the perk', () => {
    const s = shopRun({}, { cards: [{ cardId: 'iut', modifier: null, price: 4, sold: true }] });
    const once = applyAction(s, { type: 'shopReroll' }, { ...ctx, ownedCardIds: CARDS.map((c) => c.id) }).state;
    expect(once.gold).toBe(28);
    expect(once.shop!.cards).toHaveLength(2);
    expect(once.shop!.cards.every((c) => !c.sold)).toBe(true);
    const twice = applyAction(once, { type: 'shopReroll' }, ctx).state;
    expect(twice.gold).toBe(25);
    const free = applyAction(shopRun({}, { rerollCost: 0 }), { type: 'shopReroll' }, ctx).state;
    expect(free.gold).toBe(30);
    expect(free.shop!.rerollCost).toBe(2);
  });

  it('opens boosters: pick cards or stats, or skip', () => {
    const owned = { ...ctx, ownedCardIds: CARDS.map((c) => c.id) };
    const s = shopRun({}, { packs: [{ kind: 'mega', price: 7, sold: false }, { kind: 'training', price: 4, sold: false }] });
    const opened = applyAction(s, { type: 'shopBuyPack', index: 0 }, owned).state;
    expect(opened.phase).toBe('pack');
    expect(opened.gold).toBe(23);
    expect(opened.pack!.options).toHaveLength(5);
    const one = applyAction(opened, { type: 'packPick', index: 0 }, owned).state;
    expect(one.phase).toBe('pack');
    expect(() => applyAction(one, { type: 'packPick', index: 0 }, owned)).toThrow(/Déjà choisi/);
    const two = applyAction(one, { type: 'packPick', index: 1 }, owned).state;
    expect(two.phase).toBe('shop');
    expect(two.deck).toHaveLength(2);

    const training = applyAction(two, { type: 'shopBuyPack', index: 1 }, owned).state;
    expect(training.pack!.options.every((o) => o.type === 'stat')).toBe(true);
    expect(applyAction(training, { type: 'packSkip' }, owned).state.phase).toBe('shop');
  });

  it('sells and reorders the deck, even while a booster is open', () => {
    const ids = ['complet', 'iut', 'gagou_fornite', 'glamal_csgo', 'ibra_kart'];
    // Cards of the deck could come back as a fusion: keep them out of the booster.
    const owned = { ...ctx, ownedCardIds: CARDS.map((c) => c.id).filter((id) => !ids.includes(id)) };
    const deck = ids.map((cardId) => ({ cardId, modifier: null, price: 4 }));
    const s = shopRun({ deck }, { packs: [{ kind: 'combat', price: 4, sold: false }] });
    const moved = applyAction(s, { type: 'deckMove', from: 0, to: 4 }, owned).state;
    expect(moved.deck.map((d) => d.cardId)).toEqual(['iut', 'gagou_fornite', 'glamal_csgo', 'ibra_kart', 'complet']);
    const opened = applyAction(moved, { type: 'shopBuyPack', index: 0 }, owned).state;
    expect(() => applyAction(opened, { type: 'packPick', index: 0 }, owned)).toThrow(/Deck complet/);
    const sold = applyAction(opened, { type: 'shopSell', index: 0 }, owned).state;
    expect(sold.phase).toBe('pack');
    expect(sold.gold).toBe(opened.gold + 2);
    expect(applyAction(sold, { type: 'packPick', index: 0 }, owned).state.deck).toHaveLength(5);
  });

  it('pays interest once per act, at the boss shop', () => {
    let s: RunState = { ...createRun(99, 0), level: 9, gold: 23, hp: 1e9, base: { maxHp: 1e9, damage: 1e9, critChance: 0, critDamage: 50 } };
    s = applyAction(s, { type: 'fight' }, ctx).state;
    const gold = s.gold;
    s = applyAction(s, { type: 'chooseUpgrade', index: 0 }, ctx).state;
    expect(s.shop!.interest).toBe(5);
    expect(s.gold).toBe(gold + 5);
  });

  it('sells one permanent perk per shop; Medic makes healing cheaper', () => {
    const s = shopRun({ gold: 12 }, { perk: { perk: 'medic', price: 10, sold: false } });
    const bought = applyAction(s, { type: 'shopBuyPerk' }, ctx).state;
    expect(bought.perks).toEqual(['medic']);
    expect(() => applyAction(bought, { type: 'shopBuyPerk' }, ctx)).toThrow(/Déjà/);
    const left = applyAction(bought, { type: 'shopLeave' }, ctx).state;
    const healed = applyAction({ ...left, hp: 10, gold: 3 }, { type: 'heal' }, ctx).state;
    expect(healed.gold).toBe(0);
  });

  it('upgrades runs saved before the shop rework', () => {
    const legacy = { ...createRun(1, 0), gold: 10, phase: 'shop', shop: [{ cardId: 'iut', modifier: null, price: 4, sold: false }] } as unknown as RunState;
    delete (legacy as Partial<RunState>).perks;
    const out = applyAction(legacy, { type: 'shopBuy', index: 0 }, ctx).state;
    expect(out.deck).toHaveLength(1);
    expect(out.perks).toEqual([]);
  });

  it('revives once with a revive card', () => {
    const s: RunState = {
      ...createRun(3, 0),
      level: 60,
      hp: 1,
      deck: [{ cardId: 'lucas_totem', modifier: null, price: 1 }],
    };
    const out = simulateFight(structuredClone(s), new Rng(3));
    expect(out.events.some((e) => e.type === 'revive')).toBe(true);
    expect(out.outcome).toBe('defeat');
  });

  it('executes low-HP enemies', () => {
    // Stage 11 enemy (562 HP) vs 150 damage, 0% crit: 562 → 412 → 262 → 112 (≤25%) → execute.
    const run = createRun(3, 0);
    const s: RunState = {
      ...run,
      level: 10,
      base: { ...run.base, damage: 150, critChance: 0 },
      deck: [{ cardId: 'lucas_dust', modifier: null, price: 1 }],
    };
    const out = simulateFight(structuredClone(s), new Rng(3));
    expect(out.events.some((e) => e.type === 'execute')).toBe(true);
  });

  it('ends a run on death and only allows a new run afterwards', () => {
    const doomed: RunState = { ...createRun(1, 0), level: 80, hp: 1 };
    const { state } = applyAction(doomed, { type: 'fight' }, ctx);
    expect(state.phase).toBe('dead');
    expect(() => applyAction(state, { type: 'fight' }, ctx)).toThrow(GameRuleError);
    expect(play(state, [{ type: 'newRun' }]).level).toBe(0);
  });
});

describe('acts and bosses (deck mode)', () => {
  const shopRunDeck = (): RunState => ({
    ...createRun(5, 0, 'deck'),
    phase: 'shop',
    gold: 100,
    shop: { cards: [], packs: [], perk: null, rerollCost: 2, interest: 0 },
  });
  const strong = (over: Partial<RunState> = {}): RunState => ({
    ...createRun(5, 0, 'deck'),
    hp: 1e9,
    base: { maxHp: 1e9, damage: 1e9, critChance: 0, critDamage: 50 },
    ...over,
  });

  it('has an elite at stage 5 and an announced effect boss at stage 10', () => {
    expect([1, 5, 10, 15, 20].map((s) => stageKind(s, 'deck'))).toEqual(['normal', 'elite', 'boss', 'elite', 'boss']);
    expect(createRun(5, 0, 'deck').nextBoss).not.toBeNull();
    expect(createRun(5, 0, 'classic').nextBoss).toBeNull();
    const boss = createEnemy(9, 'deck', 'colossus');
    expect(boss.kind).toBe('boss');
    expect(boss.maxHp).toBeGreaterThan(createEnemy(9, 'deck', 'thief').maxHp);
    expect(createEnemy(10, 'deck').maxHp).toBeLessThan(boss.maxHp);
  });

  it('applies boss rules: weaker crits against the Stoic, -35 % normal hits against the Armored', () => {
    const base = strong({ level: 9, base: { maxHp: 1e9, damage: 100, critChance: 75, critDamage: 100 } });
    const stoic = simulateFight({ ...structuredClone(base), nextBoss: 'stoic' }, new Rng(1));
    expect(stoic.events.find((e) => e.type === 'hit' && e.by === 'player' && e.crit)).toMatchObject({ damage: 150 });
    const noCrit = { ...base, base: { ...base.base, critChance: 0 } };
    const armored = simulateFight({ ...structuredClone(noCrit), nextBoss: 'armored' }, new Rng(1));
    expect(armored.events.find((e) => e.type === 'hit' && e.by === 'player')).toMatchObject({ damage: 65 });
    const thorns = simulateFight({ ...structuredClone(noCrit), nextBoss: 'thorns' }, new Rng(1));
    expect(thorns.events.some((e) => e.type === 'boss' && e.effect === 'thorns')).toBe(true);
  });

  it('never lets one hit take more than 30 % of max HP', () => {
    const weak: RunState = { ...createRun(5, 0, 'deck'), level: 79, hp: 1000, base: { maxHp: 1000, damage: 1, critChance: 0, critDamage: 50 } };
    const f = simulateFight(structuredClone(weak), new Rng(2));
    const hits = f.events.filter((e) => e.type === 'hit' && e.by === 'enemy');
    expect(Math.max(...hits.map((e) => (e.type === 'hit' ? e.damage : 0)))).toBeLessThanOrEqual(300);
  });

  it('rests before a boss and grants one "sursis" when the boss is almost dead', () => {
    const s: RunState = { ...createRun(5, 0, 'deck'), level: 9, hp: 100, nextBoss: 'thief', base: { maxHp: 1000, damage: 1, critChance: 0, critDamage: 50 } };
    const f = simulateFight(structuredClone(s), new Rng(3));
    expect(f.restHp).toBe(300);
    expect(f.startHp).toBe(400);
    // Staged: 3 hits bring the boss to ~19 %, the boss's 3rd hit is lethal → sursis → 4th hit wins.
    const boss = createEnemy(9, 'deck', 'thief');
    const close: RunState = { ...s, hp: 1, base: { maxHp: 800, damage: Math.ceil(boss.maxHp * 0.27), critChance: 0, critDamage: 50 } };
    const g = simulateFight(structuredClone(close), new Rng(4));
    const clutch = g.events.filter((e) => e.type === 'clutch');
    expect(clutch).toHaveLength(1);
    expect(clutch[0]!.playerHp).toBe(1);
    expect(g.outcome).toBe('victory');
  });

  it('lets the player swap the announced boss once per act, for gold', () => {
    const s = shopRunDeck();
    const swapped = applyAction(s, { type: 'bossReroll' }, ctx).state;
    expect(swapped.nextBoss).not.toBe(s.nextBoss);
    expect(swapped.gold).toBe(s.gold - 8);
    expect(() => applyAction(swapped, { type: 'bossReroll' }, ctx)).toThrow(/déjà changé/);
  });

  it('rolls a new boss after each act and wins the run at act 8, then continues', () => {
    const r = applyAction(strong({ level: 79, nextBoss: 'thief' }), { type: 'fight' }, ctx);
    expect(r.fight!.reward).toMatchObject({ actCleared: 8, victory: true });
    expect(r.state.won).toBe(true);
    // Victory chest: top-tier cases on top of the usual level-80 drop.
    const ids = r.fight!.reward!.cases.map((c) => c.caseId);
    expect(ids.filter((c) => c === 'prisma').length).toBeGreaterThanOrEqual(1);
    expect(ids.filter((c) => c === 'red').length).toBeGreaterThanOrEqual(2);
    expect(r.fight!.reward!.gold).toBeGreaterThanOrEqual(RULES.acts.victoryGold);
    expect(r.state.nextBoss).not.toBe('thief');
    expect(r.state.phase).toBe('upgrade');
    const again = applyAction(strong({ level: 89, won: true }), { type: 'fight' }, ctx);
    expect(again.fight!.reward!.victory).toBe(false);
  });

  it('gives diminishing returns on stacked passives and turns extra crit into crit damage', () => {
    // Classic keeps the original per-victory gains.
    expect(passivePower(['rage'], 'classic').damage).toBe(8);
    expect(passivePower(Array(16).fill('rage'), 'classic').damage).toBe(32);
    expect(passivePower(Array(9).fill('regen'), 'classic').healPercent).toBe(30);
    // Deck: a permanent percentage, no per-kill growth.
    expect(passivePower(['rage']).damage).toBe(0);
    expect(passivePower(['rage']).damagePercent).toBe(15);
    expect(passivePower(Array(4).fill('vitality')).hpPercent).toBe(30);
    expect(passivePower(Array(9).fill('regen')).healPercent).toBe(18);
    const base = { ...createRun(1, 0), base: { maxHp: 1000, damage: 200, critChance: 95, critDamage: 50 } };
    const st = computeStats({ ...base, bossPassives: ['rage', 'vitality'] });
    expect(st.attack).toBe(230);
    expect(st.maxHp).toBe(1150);
    expect(st.critChance).toBe(75); // deck cap
    expect(st.critDamage).toBe(90);
    expect(computeStats({ ...base, mode: 'classic' }).critChance).toBe(95);
  });

  it('says which deck card triggered on each event', () => {
    const s: RunState = {
      ...createRun(5, 0, 'deck'),
      level: 2,
      hp: 1000,
      base: { maxHp: 1000, damage: 50, critChance: 0, critDamage: 50 },
      deck: [
        { cardId: 'glamal_voiture', modifier: null, price: 0 },
        { cardId: 'glamal_pirate', modifier: null, price: 0 },
      ],
    };
    const f = simulateFight(structuredClone(s), new Rng(4));
    const steal = f.events.find((e) => e.type === 'lifesteal')!;
    expect(steal.procs).toEqual([{ card: 1, kind: 'lifesteal', amount: steal.type === 'lifesteal' ? steal.amount : 0 }]);
    const extra = f.events.find((e) => e.type === 'hit' && e.extra);
    expect(extra?.procs?.[0]).toMatchObject({ card: 0, kind: 'doubleStrikeChance' });
  });

  it('applies difficulty tiers: tougher enemies, elite effects, no interest, no rest, no sursis', () => {
    expect(createEnemy(3, 'deck', null, 2).maxHp / createEnemy(3, 'deck', null, 1).maxHp).toBeCloseTo(1.2, 2);
    // Tier 3: the elite carries a boss effect, known in advance and never the act's boss.
    const run3: RunState = { ...createRun(5, 0, 'deck', 3), level: 4 };
    const fx = eliteBoss(run3);
    expect(fx).not.toBeNull();
    expect(fx).not.toBe(run3.nextBoss);
    expect(createEnemy(4, 'deck', fx, 3).bossId).toBe(fx);
    expect(createEnemy(4, 'deck', fx, 2).bossId).toBeNull();
    expect(eliteBoss({ ...run3, palier: 2 })).toBeNull();
    // Tier 5: no rest before the boss. Tier 7: no sursis.
    const s: RunState = { ...createRun(5, 0, 'deck', 7), level: 9, hp: 100, nextBoss: 'thief', base: { maxHp: 1000, damage: 1, critChance: 0, critDamage: 50 } };
    const f = simulateFight(structuredClone(s), new Rng(3));
    expect(f.restHp).toBe(0);
    expect(f.events.some((e) => e.type === 'clutch')).toBe(false);
    // Locked tiers are refused.
    expect(() => applyAction(createRun(1, 0), { type: 'newRun', mode: 'deck', palier: 3 }, { ...ctx, maxPalier: 2 })).toThrow(/verrouillé/);
    expect(applyAction(createRun(1, 0), { type: 'newRun', mode: 'deck', palier: 2 }, { ...ctx, maxPalier: 2 }).state.palier).toBe(2);
  });

  it('sells the Forge as a repeatable service with a rising price', () => {
    let s = shopRunDeck();
    const before = computeStats(s).attack;
    s = applyAction(s, { type: 'shopForge' }, ctx).state;
    expect(s.forge).toBe(1);
    expect(s.gold).toBe(100 - 10);
    expect(computeStats(s).attack).toBeGreaterThan(before * 1.07);
    s = applyAction(s, { type: 'shopForge' }, ctx).state;
    expect(s.gold).toBe(100 - 10 - 15);
  });
});

describe('route, items, fusion, team bonuses (deck mode)', () => {
  const owned = { ...ctx, ownedCardIds: CARDS.map((c) => c.id) };
  const strong = (s: RunState): RunState => ({ ...s, hp: 99999, base: { ...s.base, maxHp: 99999, damage: 100000 } });

  it('starts each act with a forced fight, then offers 2-3 steps with at least one fight', () => {
    let s = createRun(5, 0);
    expect(s.node).toBe('fight');
    expect(() => applyAction({ ...s, node: null, route: [{ kind: 'camp' }] }, { type: 'fight' }, ctx)).toThrow(/prochaine étape/);
    s = applyAction(strong(s), { type: 'fight' }, ctx).state;
    s = applyAction(s, { type: 'chooseUpgrade', index: 0 }, ctx).state;
    expect(s.node).toBeNull();
    expect(s.route!.length).toBeGreaterThanOrEqual(2);
    expect(s.route!.some((n) => n.kind === 'fight')).toBe(true);
    expect(s.path).toEqual(['fight']);
  });

  it('plays a camp, a treasure and an event as one step each, without a fight', () => {
    const base = { ...createRun(6, 0), level: 2, node: null, gold: 50 };
    for (const kind of ['camp', 'treasure', 'event'] as const) {
      let s: RunState = { ...base, route: [{ kind }, { kind: 'fight' }], deck: [{ cardId: 'iut', modifier: null, price: 4 }] };
      s = applyAction(s, { type: 'chooseNode', index: 0 }, ctx).state;
      expect(s.phase).toBe('upgrade');
      expect(s.offer!.length).toBeGreaterThanOrEqual(2);
      s = applyAction(s, { type: 'chooseUpgrade', index: 0 }, ctx).state;
      expect(s.level).toBe(3);
      expect(s.stats.kills).toBe(0);
      expect(s.phase).toBe('ready');
      expect(s.path!.at(-1)).toBe(kind);
    }
  });

  it('opens a shop mid-act, and leaving it moves to the next step', () => {
    let s: RunState = { ...createRun(7, 0), level: 6, node: null, route: [{ kind: 'shop' }, { kind: 'fight' }], gold: 30 };
    s = applyAction(s, { type: 'chooseNode', index: 0 }, owned).state;
    expect(s.phase).toBe('shop');
    expect(s.shop!.interest).toBe(0);
    s = applyAction(s, { type: 'shopLeave' }, owned).state;
    expect(s.level).toBe(7);
    expect(s.phase).toBe('ready');
  });

  it('lets the player skip the elite for an item and a little gold', () => {
    let s = { ...createRun(8, 0), level: 4, node: null };
    s = { ...s, route: [{ kind: 'elite' as const }, { kind: 'skip' as const, item: 'potion' as const }] };
    s = applyAction(s, { type: 'chooseNode', index: 1 }, ctx).state;
    expect(s.items).toEqual(['potion']);
    expect(s.gold).toBe(3);
    expect(s.level).toBe(5);
  });

  it('uses items: potion heals, whetstone and shield last one fight, compass rerolls the route', () => {
    let s: RunState = { ...createRun(9, 0), items: ['potion', 'whetstone', 'shield'], hp: 100 };
    s = applyAction(s, { type: 'useItem', index: 0 }, ctx).state;
    expect(s.hp).toBe(600);
    s = applyAction(s, { type: 'useItem', index: 0 }, ctx).state;
    s = applyAction(s, { type: 'useItem', index: 0 }, ctx).state;
    expect(s.buffs).toEqual({ damage: 50, shield: 40 });
    const r = applyAction(s, { type: 'fight' }, ctx);
    expect((r.fight!.events.find((e) => e.type === 'hit' && e.by === 'player') as { damage: number }).damage).toBeGreaterThanOrEqual(300);
    expect(r.state.buffs).toEqual({});
    expect(() => applyAction(createRun(9, 0), { type: 'useItem', index: 0 }, ctx)).toThrow(/inconnu/);
  });

  it('fuses a duplicate card into a starred one instead of taking a slot', () => {
    const deck = [{ cardId: 'gagou_fornite', modifier: null, price: 4 }];
    let s: RunState = { ...createRun(10, 0), phase: 'shop', gold: 50, deck, shop: { cards: [{ cardId: 'gagou_fornite', modifier: null, price: 4, sold: false }], packs: [], perk: null, rerollCost: 2, interest: 0 } };
    s = applyAction(s, { type: 'shopBuy', index: 0 }, owned).state;
    expect(s.deck).toHaveLength(1);
    expect(s.deck[0]!.stars).toBe(2);
    // +10 % damage card, ×1.5 with the star: +15 %.
    expect(deckEffects(s.deck)[0]).toMatchObject({ kind: 'percentDamage', value: 15 });
  });

  it('grants team bonuses for 2, 3 and 4 cards of the same friend', () => {
    const run = (ids: string[]) => ({ ...createRun(11, 0), deck: ids.map((cardId) => ({ cardId, modifier: null, price: 4 })) });
    const cc = (ids: string[]) => computeStats(run(ids)).critChance;
    const base = cc(['glamal_csgo']);
    expect(cc(['glamal_csgo', 'glamal_neige'])).toBe(base + 5);
    expect(cc(['glamal_csgo', 'glamal_neige', 'glamal_onsen'])).toBe(base + 10);
  });

  it('offers three boss passives including a pact, and pacts trade a bonus for a drawback', () => {
    let s: RunState = { ...createRun(12, 0), level: 9, hp: 99999, base: { ...createRun(12, 0).base, maxHp: 99999, damage: 10_000_000 } };
    s = applyAction(s, { type: 'fight' }, ctx).state;
    expect(s.offer).toHaveLength(3);
    expect(s.offer!.some((o) => o.kind === 'bossPassive' && ['fury', 'bulwark', 'greed'].includes(o.passive))).toBe(true);
    const fury = passivePower(['fury']);
    expect(fury.damagePercent).toBe(30);
    expect(fury.hpPercent).toBe(-15);
  });

  it('counts only one Negative card for the deck size', () => {
    const neg = (cardId: string) => ({ cardId, modifier: 'negative' as const, price: 4 });
    const s = { ...createRun(13, 0), deck: [neg('iut'), neg('complet')] };
    expect(computeStats(s).emptySlots).toBe(RULES.baseDeckSize + 1 - 2);
  });
});
