import { getCard } from '../cards.js';
import { CASE_TYPES, caseTypeForLevel } from '../cases.js';
import { bossPool } from '../bosses.js';
import type { RunAction } from '../protocol.js';
import { RULES, isLootLevel, maxCasesForLevel } from '../rules.js';
import { simulateFight } from './combat.js';
import { Rng } from './rng.js';
import { bossRerollPrice, forgePrice, healCost, nextBossAct, normalizeRun, openPack, openShop, rerollCards } from './shop.js';
import { computeStats, deckEffects, deckLimit, ofKind, passivePower, srcOf, sumEffect } from './stats.js';
import type {
  BossPassive,
  Proc,
  CaseDrop,
  DeckCard,
  EnemyInfo,
  FightResult,
  KillReward,
  GameMode,
  PublicRunState,
  RunState,
  UpgradeOffer,
} from './types.js';

export class GameRuleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export interface ActionContext {
  /** Card ids the player owns in their permanent collection (feeds the shop). */
  ownedCardIds: readonly string[];
  /** Fresh seed used when the action starts a new run (provided by the server's CSPRNG). */
  newSeed: number;
  /** Highest difficulty tier this player has unlocked (default 1). */
  maxPalier?: number;
  now: number;
}

export interface ActionResult {
  state: RunState;
  fight?: FightResult;
}

export function createRun(seed: number, now: number, mode: GameMode = 'deck', palier = 1): RunState {
  const { maxHp, damage, critChance, critDamage } = RULES.player;
  const rng = new Rng(seed);
  const nextBoss = mode === 'deck' ? rng.pick(bossPool(1, null)) : null;
  return {
    version: 1,
    mode,
    phase: 'ready',
    level: 0,
    gold: 0,
    base: { maxHp, damage, critChance, critDamage },
    hp: maxHp,
    deck: [],
    bossPassives: [],
    critUpgrades: 0,
    casesFound: 0,
    reviveUsed: false,
    offer: null,
    shop: null,
    pack: null,
    perks: [],
    forge: 0,
    palier: mode === 'deck' ? palier : 1,
    nextBoss,
    won: false,
    bossRerollAct: 0,
    stats: { kills: 0, bossKills: 0, damageDealt: 0, goldEarned: 0 },
    startedAt: now,
    rng: rng.state,
  };
}

export function toPublic(state: RunState): PublicRunState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rng, ...rest } = normalizeRun(structuredClone(state));
  return rest;
}

const fail = (code: string, message: string): never => {
  throw new GameRuleError(code, message);
};

function requirePhase(state: RunState, ...phases: RunState['phase'][]) {
  if (!phases.includes(state.phase)) fail('WRONG_PHASE', `Action impossible pendant la phase « ${state.phase} »`);
}

/**
 * Apply one player action. Pure: never mutates `input`, returns a new state.
 * Throws GameRuleError when the action is not allowed.
 */
export function applyAction(input: RunState, action: RunAction, ctx: ActionContext): ActionResult {
  if (action.type === 'newRun') {
    const mode = action.mode ?? runMode(input);
    const max = ctx.maxPalier ?? 1;
    if (action.palier !== undefined && action.palier > max) fail('LOCKED', `Palier ${action.palier} verrouillé : gagne une partie au palier ${action.palier - 1}`);
    const palier = Math.max(1, Math.min(max, action.palier ?? input.palier ?? 1));
    return { state: createRun(ctx.newSeed, ctx.now, mode, palier) };
  }

  const state = normalizeRun(structuredClone(input));
  const rng = new Rng(state.rng);
  const done = (extra: Omit<ActionResult, 'state'> = {}): ActionResult => {
    state.rng = rng.state;
    return { state, ...extra };
  };

  switch (action.type) {
    case 'fight': {
      requirePhase(state, 'ready');
      const combat = simulateFight(state, rng);
      state.stats.damageDealt += combat.damageDealt;
      if (combat.outcome === 'defeat') {
        state.phase = 'dead';
        return done({ fight: { ...combat, reward: null } });
      }
      const reward = grantKillReward(state, rng, combat.enemy);
      state.offer = combat.enemy.isBoss ? rollBossOffer(rng) : rollUpgradeOffer(rng);
      state.phase = 'upgrade';
      return done({ fight: { ...combat, reward } });
    }

    case 'chooseUpgrade': {
      requirePhase(state, 'upgrade');
      const offer = state.offer?.[action.index] ?? fail('BAD_INDEX', 'Amélioration inconnue');
      applyUpgrade(state, offer);
      state.offer = null;
      if (runMode(state) === 'deck' && state.level % RULES.shopEvery === 0) {
        state.shop = openShop(rng, state, ctx.ownedCardIds);
        state.phase = 'shop';
      } else {
        state.phase = 'ready';
      }
      return done();
    }

    case 'heal': {
      requirePhase(state, 'ready');
      const { maxHp } = computeStats(state);
      if (state.hp >= maxHp) fail('FULL_HP', 'Points de vie déjà au maximum');
      const cost = healCost(state);
      if (state.gold < cost) fail('NO_GOLD', 'Or insuffisant');
      state.gold -= cost;
      state.hp = maxHp;
      return done();
    }

    case 'shopBuy': {
      requirePhase(state, 'shop');
      const item = state.shop!.cards[action.index] ?? fail('BAD_INDEX', 'Article inconnu');
      if (item.sold) fail('SOLD', 'Article déjà acheté');
      if (state.gold < item.price) fail('NO_GOLD', 'Or insuffisant');
      addToDeck(state, { cardId: item.cardId, modifier: item.modifier, price: item.price });
      state.gold -= item.price;
      item.sold = true;
      return done();
    }

    case 'deckMove': {
      requirePhase(state, 'shop', 'pack', 'ready');
      const { from, to } = action;
      if (!state.deck[from] || !state.deck[to]) fail('BAD_INDEX', 'Carte inconnue');
      const [card] = state.deck.splice(from, 1);
      state.deck.splice(to, 0, card!);
      return done();
    }

    case 'shopSell': {
      // Also allowed while a booster is open, to make room for a card.
      requirePhase(state, 'shop', 'pack');
      const entry = state.deck[action.index] ?? fail('BAD_INDEX', 'Carte inconnue');
      changeDeck(state, state.deck.filter((_, i) => i !== action.index));
      state.gold += sellValue(entry);
      return done();
    }

    case 'shopReroll': {
      requirePhase(state, 'shop');
      const shop = state.shop!;
      if (state.gold < shop.rerollCost) fail('NO_GOLD', 'Or insuffisant');
      state.gold -= shop.rerollCost;
      rerollCards(rng, state, shop, ctx.ownedCardIds);
      return done();
    }

    case 'shopBuyPack': {
      requirePhase(state, 'shop');
      const offer = state.shop!.packs[action.index] ?? fail('BAD_INDEX', 'Booster inconnu');
      if (offer.sold) fail('SOLD', 'Booster déjà acheté');
      if (state.gold < offer.price) fail('NO_GOLD', 'Or insuffisant');
      state.gold -= offer.price;
      offer.sold = true;
      state.pack = openPack(rng, state, offer.kind, ctx.ownedCardIds);
      state.phase = 'pack';
      return done();
    }

    case 'packPick': {
      requirePhase(state, 'pack');
      const pack = state.pack!;
      const option = pack.options[action.index] ?? fail('BAD_INDEX', 'Choix inconnu');
      if (pack.taken.includes(action.index)) fail('TAKEN', 'Déjà choisi');
      if (option.type === 'card') addToDeck(state, { cardId: option.cardId, modifier: option.modifier, price: 0 });
      else applyUpgrade(state, option.offer);
      pack.taken.push(action.index);
      pack.picksLeft--;
      if (pack.picksLeft <= 0 || pack.taken.length >= pack.options.length) closePack(state);
      return done();
    }

    case 'packSkip': {
      requirePhase(state, 'pack');
      closePack(state);
      return done();
    }

    case 'shopBuyPerk': {
      requirePhase(state, 'shop');
      const offer = state.shop!.perk ?? fail('BAD_INDEX', 'Aucune amélioration');
      if (offer.sold) fail('SOLD', 'Déjà achetée');
      if (state.gold < offer.price) fail('NO_GOLD', 'Or insuffisant');
      state.gold -= offer.price;
      offer.sold = true;
      // Shops saved before the Forge became a service may still offer it here.
      if ((offer.perk as string) === 'forge') state.forge++;
      else state.perks.push(offer.perk);
      return done();
    }

    case 'shopForge': {
      requirePhase(state, 'shop');
      const price = forgePrice(state);
      if (state.gold < price) fail('NO_GOLD', 'Or insuffisant');
      state.gold -= price;
      state.forge++;
      return done();
    }

    case 'bossReroll': {
      requirePhase(state, 'shop');
      if (runMode(state) !== 'deck' || !state.nextBoss) fail('NO_BOSS', 'Aucun boss à changer');
      const act = nextBossAct(state);
      if (state.bossRerollAct === act) fail('ALREADY', 'Boss déjà changé pour cet acte');
      const price = bossRerollPrice(state);
      if (state.gold < price) fail('NO_GOLD', 'Or insuffisant');
      state.gold -= price;
      state.bossRerollAct = act;
      state.nextBoss = rng.pick(bossPool(act, state.nextBoss));
      return done();
    }

    case 'shopLeave': {
      requirePhase(state, 'shop');
      state.shop = null;
      state.phase = 'ready';
      return done();
    }
  }
}

export function runMode(state: Pick<RunState, 'mode'>): GameMode {
  return state.mode ?? 'deck';
}

/** Cards taken from boosters cost nothing and sell for 1. */
export function sellValue(entry: DeckCard): number {
  return Math.max(1, Math.floor(entry.price * RULES.sellBackRate));
}

function addToDeck(state: RunState, entry: DeckCard) {
  if (state.deck.some((c) => c.cardId === entry.cardId)) fail('DUPLICATE', 'Cette carte est déjà dans le deck');
  const next = [...state.deck, entry];
  if (next.length > deckLimit(next, state.perks)) fail('DECK_FULL', 'Deck complet : vends une carte d’abord');
  changeDeck(state, next);
}

function closePack(state: RunState) {
  state.pack = null;
  state.phase = 'shop';
}

/** Replace the deck while keeping the same HP ratio (max HP may change with cards). */
function changeDeck(state: RunState, deck: DeckCard[]) {
  const before = computeStats(state).maxHp;
  state.deck = deck;
  const after = computeStats(state).maxHp;
  state.hp = Math.max(1, Math.min(after, Math.round((state.hp / before) * after)));
}

function grantKillReward(state: RunState, rng: Rng, enemy: EnemyInfo): KillReward {
  const fx = deckEffects(state.deck);
  const deck = runMode(state) === 'deck';
  const isBoss = enemy.kind === 'boss';
  state.level++;
  state.stats.kills++;
  if (isBoss) state.stats.bossKills++;

  const actBonus = Math.floor((enemy.act - 1) / RULES.acts.goldEveryActs);
  const bonus = !deck
    ? isBoss ? RULES.bossGoldBonus : 0
    : actBonus + (isBoss ? RULES.acts.bossGold + enemy.act : enemy.kind === 'elite' ? RULES.acts.eliteGold : 0);
  const gold = RULES.goldPerKill + sumEffect(fx, 'goldPerKill') + bonus;
  const procs: Proc[] = ofKind(fx, 'goldPerKill').map((e) => ({ card: srcOf(e), kind: e.kind, amount: e.value }));
  state.gold += gold;
  earnGold(state, gold);

  const power = passivePower(state.bossPassives, runMode(state));
  state.base.damage += power.damage;
  state.base.maxHp += power.maxHp;

  let victory = false;
  if (deck && isBoss) {
    state.nextBoss = rng.pick(bossPool(enemy.act + 1, enemy.bossId));
    if (enemy.act >= RULES.acts.winAct && !state.won) {
      state.won = true;
      victory = true;
      state.gold += RULES.acts.victoryGold;
      earnGold(state, RULES.acts.victoryGold);
    }
  }

  const maxHp = computeStats(state).maxHp;
  let healPercent = 0;
  for (const e of ofKind(fx, 'healOnKill')) {
    if (e.chance === undefined || rng.chance(e.chance)) {
      healPercent += e.value;
      procs.push({ card: srcOf(e), kind: e.kind, amount: e.value });
    }
  }
  for (const e of ofKind(fx, 'healOnKillPerGold')) {
    const v = Math.min(state.gold * e.value, e.max);
    healPercent += v;
    if (v > 0) procs.push({ card: srcOf(e), kind: e.kind, amount: Math.round(v) });
  }
  healPercent += power.healPercent;
  healPercent += RULES.recoveryPercent;
  const hpBefore = state.hp;
  state.hp = Math.min(maxHp, state.hp + Math.floor((maxHp * healPercent) / 100));

  const cases: CaseDrop[] = [];
  if (isLootLevel(state.level)) {
    const count = rng.int(1, maxCasesForLevel(state.level));
    for (let i = 0; i < count; i++) cases.push({ caseId: rollCaseType(state.level, rng) });
    state.casesFound += count;
  }

  if (victory) {
    for (const caseId of RULES.acts.victoryChest) cases.push({ caseId });
    state.casesFound += RULES.acts.victoryChest.length;
  }

  return { procs, gold: gold + (victory ? RULES.acts.victoryGold : 0), healed: state.hp - hpBefore, cases, actCleared: deck && isBoss ? enemy.act : null, victory };
}

function earnGold(state: RunState, amount: number) {
  // `?? 0` keeps runs saved before this counter existed working.
  state.stats.goldEarned = (state.stats.goldEarned ?? 0) + amount;
}

function rollCaseType(level: number, rng: Rng) {
  const base = caseTypeForLevel(level);
  if (rng.next() < RULES.caseUpgradeChance) {
    const next = CASE_TYPES[CASE_TYPES.indexOf(base) + 1];
    if (next) return next.id;
  }
  return base.id;
}

function rollUpgradeOffer(rng: Rng): UpgradeOffer[] {
  const pool: UpgradeOffer[] = [
    { kind: 'maxHp', value: rng.int(25, 54) },
    { kind: 'damage', value: rng.int(10, 29) },
    { kind: 'fullHeal' },
    { kind: 'gold', value: 3 },
    { kind: 'critDamage', value: rng.int(5, 19) },
    { kind: 'critChance', value: rng.int(1, 4) },
  ];
  return rng.sample(pool, 2);
}

function rollBossOffer(rng: Rng): UpgradeOffer[] {
  const passives: BossPassive[] = ['regen', 'rage', 'vitality'];
  return rng.sample(passives, 2).map((passive) => ({ kind: 'bossPassive', passive }));
}

function applyUpgrade(state: RunState, offer: UpgradeOffer) {
  switch (offer.kind) {
    case 'maxHp':
      state.base.maxHp += offer.value;
      break;
    case 'damage':
      state.base.damage += offer.value;
      break;
    case 'fullHeal':
      state.hp = computeStats(state).maxHp;
      break;
    case 'gold':
      state.gold += offer.value;
      earnGold(state, offer.value);
      break;
    case 'critDamage':
      state.base.critDamage += offer.value;
      break;
    case 'critChance':
      state.base.critChance += offer.value;
      state.critUpgrades++;
      break;
    case 'bossPassive':
      state.bossPassives.push(offer.passive);
      break;
  }
}


export { getCard };
