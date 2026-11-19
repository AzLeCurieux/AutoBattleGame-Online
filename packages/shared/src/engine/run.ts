import { getCard } from '../cards.js';
import { CASE_TYPES, caseTypeForLevel } from '../cases.js';
import { bossPool } from '../bosses.js';
import type { RunAction } from '../protocol.js';
import { ITEMS, MAX_ITEMS } from '../items.js';
import { RULES, isLootLevel, maxCasesForLevel } from '../rules.js';
import { simulateFight } from './combat.js';
import { forcedNode, isFightNode, isJunction, nodeOffers, rollRoute, stepOf } from './route.js';
import { Rng } from './rng.js';
import { bossRerollPrice, forgePrice, healCost, nextBossAct, normalizeRun, openPack, openShop, rerollCards } from './shop.js';
import { computeStats, deckEffects, deckLimit, ofKind, passivePower, srcOf, sumEffect } from './stats.js';
import { BOSS_PASSIVES } from './types.js';
import type {
  ItemId,
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
  RouteNode,
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
    route: null,
    plan: [],
    nodeItem: null,
    node: mode === 'deck' ? 'fight' : null,
    path: [],
    items: [],
    buffs: {},
    stats: { kills: 0, bossKills: 0, damageDealt: 0, goldEarned: 0 },
    startedAt: now,
    rng: rng.state,
  };
}

/**
 * Deck mode: sets up the next step — forced (first fight, boss), a junction
 * (choose a path), or the next step of the chosen path, which starts on its
 * own. Called whenever the run is back to 'ready'.
 */
function prepareStep(state: RunState, rng: Rng, ctx: ActionContext) {
  if (runMode(state) !== 'deck') return;
  if (stepOf(state.level) === 1) {
    state.path = [];
    state.plan = [];
  }
  state.route = null;
  const forced = forcedNode(state.level);
  if (forced) {
    state.node = forced;
    return;
  }
  if (isJunction(state.level)) {
    state.node = null;
    state.plan = [];
    state.route = rollRoute(state, rng);
    return;
  }
  const next = state.plan?.[0];
  state.plan = (state.plan ?? []).slice(1);
  startNode(state, next ?? { kind: 'fight' }, rng, ctx);
}

/** Enters a step: fights wait for "Combattre", the others open their choice right away. */
function startNode(state: RunState, node: RouteNode, rng: Rng, ctx: ActionContext) {
  state.node = node.kind;
  state.nodeItem = node.item ?? null;
  switch (node.kind) {
    case 'camp':
    case 'treasure':
    case 'event':
      state.offer = nodeOffers(state, node.kind, rng, node.item);
      state.phase = 'upgrade';
      break;
    case 'shop':
      state.shop = openShop(rng, state, ctx.ownedCardIds);
      state.phase = 'shop';
      break;
    case 'skip':
      // Going around the elite: no fight, no level-up pick, but an item and a little gold.
      if (!node.item || !giveItem(state, node.item)) state.gold += 4;
      state.gold += 3;
      earnGold(state, 3);
      finishStep(state);
      prepareStep(state, rng, ctx);
      break;
    default:
      break; // fights: the player presses "Combattre"
  }
}

/** A non-fight step is over: it counts as one step of the act. */
function finishStep(state: RunState) {
  state.path = [...(state.path ?? []), state.node ?? 'fight'];
  state.node = null;
  state.level++;
}

function giveItem(state: RunState, item: ItemId): boolean {
  const items = state.items ?? [];
  if (items.length >= MAX_ITEMS) return false;
  state.items = [...items, item];
  return true;
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
      if (runMode(state) === 'deck' && !isFightNode(state.node)) fail('CHOOSE_NODE', 'Choisis d’abord ta prochaine étape');
      const combat = simulateFight(state, rng);
      state.buffs = {};
      state.stats.damageDealt += combat.damageDealt;
      if (combat.outcome === 'defeat') {
        state.phase = 'dead';
        return done({ fight: { ...combat, reward: null } });
      }
      const reward = grantKillReward(state, rng, combat.enemy);
      if (runMode(state) === 'deck') {
        state.path = [...(state.path ?? []), state.node ?? 'fight'];
        state.node = null;
      }
      state.offer = combat.enemy.isBoss ? rollBossOffer(rng) : rollUpgradeOffer(rng);
      state.phase = 'upgrade';
      return done({ fight: { ...combat, reward } });
    }

    case 'chooseNode': {
      requirePhase(state, 'ready');
      const route = state.route ?? fail('NO_ROUTE', 'Aucun chemin à choisir');
      const path = route[action.index] ?? fail('BAD_INDEX', 'Chemin inconnu');
      state.route = null;
      state.plan = path.steps.slice(1);
      startNode(state, path.steps[0]!, rng, ctx);
      return done();
    }

    case 'chooseUpgrade': {
      requirePhase(state, 'upgrade');
      const offer = state.offer?.[action.index] ?? fail('BAD_INDEX', 'Amélioration inconnue');
      applyUpgrade(state, offer, rng);
      state.offer = null;
      // Camp, treasure and event steps end here; fights already counted the step.
      if (state.node && !isFightNode(state.node)) finishStep(state);
      if (runMode(state) === 'deck' && state.level % RULES.shopEvery === 0) {
        state.shop = openShop(rng, state, ctx.ownedCardIds);
        state.phase = 'shop';
      } else {
        state.phase = 'ready';
        prepareStep(state, rng, ctx);
      }
      return done();
    }

    case 'useItem': {
      requirePhase(state, 'ready', 'shop');
      const items = state.items ?? [];
      const item = items[action.index] ?? fail('BAD_INDEX', 'Objet inconnu');
      useItem(state, item, rng);
      state.items = items.filter((_, i) => i !== action.index);
      return done();
    }

    case 'shopBuyItem': {
      requirePhase(state, 'shop');
      const offer = state.shop!.item ?? fail('BAD_INDEX', 'Aucun objet en vente');
      if (offer.sold) fail('SOLD', 'Déjà acheté');
      if (state.gold < offer.price) fail('NO_GOLD', 'Or insuffisant');
      if (!giveItem(state, offer.item)) fail('FULL', `${MAX_ITEMS} objets maximum : utilises-en un d’abord`);
      state.gold -= offer.price;
      offer.sold = true;
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
      if (state.node === 'shop') finishStep(state);
      prepareStep(state, rng, ctx);
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

/** Highest card level (raised at the camp). */
export const MAX_STARS = 3;

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
  const greed = passivePower(state.bossPassives, runMode(state)).goldPerKill;
  const gold = (RULES.goldPerKill + sumEffect(fx, 'goldPerKill') + bonus + greed) * (state.buffs?.gold ?? 1);
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

/** Three passives out of six: always at least one pact (bonus with a drawback). */
function rollBossOffer(rng: Rng): UpgradeOffer[] {
  const pacts: BossPassive[] = ['fury', 'bulwark', 'greed'];
  const pact = rng.pick(pacts);
  const rest = rng.sample(BOSS_PASSIVES.filter((p) => p !== pact), 2);
  return rng.sample([pact, ...rest], 3).map((passive) => ({ kind: 'bossPassive', passive }));
}

const EDITIONS = ['foil', 'holographic', 'polychrome'] as const;

/** Gives an edition to a random deck card that has none. Returns false if none qualifies. */
function addEdition(state: RunState, rng: Rng): boolean {
  const plain = state.deck.map((d, i) => ({ d, i })).filter(({ d }) => !d.modifier);
  if (plain.length === 0) return false;
  const { i } = rng.pick(plain);
  const modifier = rng.pick(EDITIONS);
  changeDeck(state, state.deck.map((c, k) => (k === i ? { ...c, modifier } : c)));
  return true;
}

function useItem(state: RunState, item: ItemId, rng: Rng) {
  const buffs = { ...(state.buffs ?? {}) };
  switch (item) {
    case 'potion': {
      const { maxHp } = computeStats(state);
      if (state.hp >= maxHp) fail('FULL_HP', 'Points de vie déjà au maximum');
      state.hp = Math.min(maxHp, state.hp + Math.floor(maxHp * 0.5));
      break;
    }
    case 'whetstone':
      buffs.damage = (buffs.damage ?? 0) + 50;
      break;
    case 'shield':
      buffs.shield = Math.min(80, (buffs.shield ?? 0) + 40);
      break;
    case 'luckyCoin':
      buffs.gold = (buffs.gold ?? 1) * 2;
      break;
    case 'prism':
      if (!addEdition(state, rng)) fail('NO_TARGET', 'Toutes les cartes du deck ont déjà une édition');
      break;
    case 'compass':
      if (state.phase !== 'ready' || !state.route) fail('NO_ROUTE', 'Utilisable quand tu choisis ton prochain chemin');
      state.route = rollRoute(state, rng);
      break;
  }
  state.buffs = buffs;
}

function applyUpgrade(state: RunState, offer: UpgradeOffer, rng?: Rng) {
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
    case 'heal': {
      const { maxHp } = computeStats(state);
      state.hp = Math.min(maxHp, state.hp + Math.floor((maxHp * offer.percent) / 100));
      break;
    }
    case 'item':
      if (!giveItem(state, offer.item)) {
        // Bag full: the item is sold on the spot.
        state.gold += Math.ceil(ITEMS[offer.item].price / 2);
      }
      break;
    case 'gamble':
      state.hp = Math.max(1, state.hp - Math.floor((state.hp * offer.hpPercent) / 100));
      state.gold += offer.gold;
      earnGold(state, offer.gold);
      break;
    case 'sacrifice': {
      const before = computeStats(state).maxHp;
      state.base.maxHp = Math.floor(state.base.maxHp * (1 - offer.hpPercent / 100));
      state.forge++;
      const after = computeStats(state).maxHp;
      state.hp = Math.max(1, Math.min(after, Math.round((state.hp / before) * after)));
      break;
    }
    case 'edition':
      if (state.gold < offer.price) fail('NO_GOLD', 'Or insuffisant');
      if (rng && addEdition(state, rng)) state.gold -= offer.price;
      break;
    case 'leave':
      break;
    case 'cardLevel': {
      const card = state.deck[offer.index];
      if (!card || card.cardId !== offer.cardId) fail('BAD_INDEX', 'Carte introuvable dans le deck');
      changeDeck(state, state.deck.map((c, i) => (i === offer.index ? { ...c, stars: Math.min(MAX_STARS, (c.stars ?? 1) + 1) } : c)));
      break;
    }
  }
}


export { getCard };
