import { bossPool } from '../bosses.js';
import { CARDS, type Card } from '../cards.js';
import { MODIFIERS, MODIFIER_BY_ID } from '../modifiers.js';
import { RARITIES, RARITY_INFO, type Rarity } from '../rarity.js';
import { RULES, palierRules } from '../rules.js';
import type { BossId } from '../bosses.js';
import type { Rng } from './rng.js';
import type {
  ModifierId,
  OpenPack,
  PackKind,
  PackOffer,
  PackOption,
  PerkId,
  PerkOffer,
  RunState,
  ShopItem,
  ShopState,
  UpgradeOffer,
} from './types.js';
import { PERK_IDS } from './types.js';

/**
 * Deck-mode shop: card slots (rerollable), booster packs, and one permanent
 * perk per visit. Everything is rolled from the run's seeded RNG on the server.
 */

export interface PackInfo {
  price: number;
  /** Number of options shown when the pack is opened. */
  size: number;
  picks: number;
}

export const PACKS: Record<PackKind, PackInfo> = {
  combat: { price: 4, size: 3, picks: 1 },
  mega: { price: 7, size: 5, picks: 2 },
  training: { price: 4, size: 3, picks: 1 },
  shiny: { price: 6, size: 2, picks: 1 },
};

export const PERK_PRICE = RULES.perkPrice;

const SHOP_WEIGHTS = [26.316, 22.632, 21.105, 14.684, 7.895, 5.411, 1.958];
/** "Flair" doubles the weight of every rarity above Mil-spec. */
const FLAIR_WEIGHTS = SHOP_WEIGHTS.map((w, i) => (i >= 3 ? w * 2.2 : w));

export const forgePrice = (state: Pick<RunState, 'forge'>) => 8 + 4 * (state.forge ?? 0);

/** Act whose boss is announced (the shop after a boss already shows the next act's). */
export const nextBossAct = (state: Pick<RunState, 'level'>) => Math.floor(state.level / RULES.acts.length) + 1;

export const bossRerollPrice = (state: Pick<RunState, 'level'>) => RULES.acts.bossRerollBase + RULES.acts.bossRerollPerAct * nextBossAct(state);

/**
 * Effect carried by the elite of the coming act (tier 3+). Fixed per act and
 * never the act's boss, so the player can see it coming and prepare.
 */
export function eliteBoss(run: Pick<RunState, 'level' | 'mode' | 'nextBoss'> & { palier?: number }): BossId | null {
  if ((run.mode ?? 'deck') !== 'deck' || !palierRules(run.palier).eliteEffect) return null;
  const act = Math.floor(run.level / RULES.acts.length) + 1;
  const pool = bossPool(act, null);
  let i = (act * 7 + 3) % pool.length;
  if (pool[i] === run.nextBoss) i = (i + 1) % pool.length;
  return pool[i]!;
}

export const hasPerk = (state: Pick<RunState, 'perks'>, perk: PerkId) => (state.perks ?? []).includes(perk);

/** Deck mode: +1 gold per act, so healing competes with the shop all game long. */
export function healCost(state: Pick<RunState, 'perks' | 'level' | 'mode'>): number {
  const act = (state.mode ?? 'deck') === 'deck' ? Math.floor(state.level / RULES.acts.length) : 0;
  return Math.max(1, RULES.healCost + act * RULES.acts.healCostPerAct - (hasPerk(state, 'medic') ? 2 : 0));
}

export function interestCap(state: Pick<RunState, 'perks'>): number {
  return RULES.interestCap + (hasPerk(state, 'vault') ? 5 : 0);
}

const discounted = (state: Pick<RunState, 'perks'>, price: number) =>
  hasPerk(state, 'discount') ? Math.max(1, Math.ceil(price * 0.75)) : price;

function weightedRarity(rng: Rng, rarities: Rarity[], flair: boolean): Rarity {
  const table = flair ? FLAIR_WEIGHTS : SHOP_WEIGHTS;
  const weights = rarities.map((r) => table[RARITIES.indexOf(r)] ?? 0);
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rarities.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return rarities[i]!;
  }
  return rarities[rarities.length - 1]!;
}

function rollModifier(rng: Rng, guaranteed = false): ModifierId | null {
  if (guaranteed) {
    const total = MODIFIERS.reduce((a, m) => a + m.chance, 0);
    let roll = rng.next() * total;
    for (const m of MODIFIERS) {
      roll -= m.chance;
      if (roll < 0) return m.id;
    }
    return MODIFIERS[MODIFIERS.length - 1]!.id;
  }
  let roll = rng.next();
  for (const m of MODIFIERS) {
    roll -= m.chance;
    if (roll < 0) return m.id;
  }
  return null;
}

/** Cards that can show up: the player's collection, minus what is already in the deck. */
function cardPool(state: RunState, ownedCardIds: readonly string[], exclude: readonly string[]): Card[] {
  const owned = new Set(ownedCardIds);
  const banned = new Set([...state.deck.map((d) => d.cardId), ...exclude]);
  let pool = CARDS.filter((c) => owned.has(c.id) && !banned.has(c.id));
  // New players have (almost) no collection: top the pool up with common cards.
  if (pool.length < 6) pool = [...pool, ...CARDS.filter((c) => c.rarity === 'consumer' && !owned.has(c.id) && !banned.has(c.id))];
  return pool;
}

function drawCards(rng: Rng, state: RunState, ownedCardIds: readonly string[], count: number, exclude: readonly string[] = []): Card[] {
  const available = cardPool(state, ownedCardIds, exclude);
  const flair = hasPerk(state, 'flair');
  const out: Card[] = [];
  while (out.length < count && available.length > 0) {
    const rarities = RARITIES.filter((r) => available.some((c) => c.rarity === r));
    const rarity = weightedRarity(rng, rarities, flair);
    const card = rng.pick(available.filter((c) => c.rarity === rarity));
    available.splice(available.indexOf(card), 1);
    out.push(card);
  }
  return out;
}

export function cardPrice(state: Pick<RunState, 'perks'>, card: Card, modifier: ModifierId | null): number {
  const mult = modifier ? MODIFIER_BY_ID.get(modifier)!.priceMultiplier : 1;
  return discounted(state, Math.ceil(RARITY_INFO[card.rarity].shopPrice * mult));
}

function rollShopCards(rng: Rng, state: RunState, ownedCardIds: readonly string[]): ShopItem[] {
  const slots = RULES.shopCardSlots + (hasPerk(state, 'bigShop') ? 1 : 0);
  return drawCards(rng, state, ownedCardIds, slots).map((card) => {
    const modifier = rollModifier(rng);
    return { cardId: card.id, modifier, price: cardPrice(state, card, modifier), sold: false };
  });
}

function rollPacks(rng: Rng, state: RunState): PackOffer[] {
  const kinds: PackKind[] = ['combat', 'combat', 'training', 'training', 'mega', 'shiny'];
  return Array.from({ length: RULES.shopPackSlots }, () => {
    const kind = rng.pick(kinds);
    return { kind, price: discounted(state, PACKS[kind].price), sold: false };
  });
}

function rollPerk(rng: Rng, state: RunState): PerkOffer | null {
  const available = PERK_IDS.filter((p) => !hasPerk(state, p));
  return available.length ? { perk: rng.pick(available), price: PERK_PRICE, sold: false } : null;
}

/** Opens the shop: pays interest first, then rolls every slot. */
export function openShop(rng: Rng, state: RunState, ownedCardIds: readonly string[]): ShopState {
  // Interest is paid once per act (boss shop), not at the mid-act elite shop.
  const bossShop = state.level % RULES.acts.length === 0 && palierRules(state.palier).interest;
  const interest = bossShop ? Math.min(interestCap(state), Math.floor(state.gold / RULES.interestStep)) : 0;
  state.gold += interest;
  state.stats.goldEarned = (state.stats.goldEarned ?? 0) + interest;
  return {
    cards: rollShopCards(rng, state, ownedCardIds),
    packs: rollPacks(rng, state),
    perk: rollPerk(rng, state),
    rerollCost: hasPerk(state, 'freeReroll') ? 0 : RULES.rerollBaseCost,
    interest,
  };
}

export function rerollCards(rng: Rng, state: RunState, shop: ShopState, ownedCardIds: readonly string[]) {
  shop.cards = rollShopCards(rng, state, ownedCardIds);
  shop.rerollCost = shop.rerollCost === 0 ? RULES.rerollBaseCost : shop.rerollCost + 1;
}

/** Training packs: the level-up offers, but stronger. */
function rollTraining(rng: Rng, count: number): PackOption[] {
  const pool: UpgradeOffer[] = [
    { kind: 'maxHp', value: rng.int(70, 120) },
    { kind: 'damage', value: rng.int(30, 55) },
    { kind: 'critChance', value: rng.int(3, 6) },
    { kind: 'critDamage', value: rng.int(20, 40) },
    { kind: 'gold', value: rng.int(5, 8) },
    { kind: 'fullHeal' },
  ];
  return rng.sample(pool, Math.min(count, pool.length)).map((offer) => ({ type: 'stat', offer }));
}

export function openPack(rng: Rng, state: RunState, kind: PackKind, ownedCardIds: readonly string[]): OpenPack {
  const info = PACKS[kind];
  const size = info.size + (hasPerk(state, 'stuffedPacks') ? 1 : 0);
  const options: PackOption[] =
    kind === 'training'
      ? rollTraining(rng, size)
      : drawCards(rng, state, ownedCardIds, size).map((card) => ({
          type: 'card',
          cardId: card.id,
          modifier: rollModifier(rng, kind === 'shiny'),
        }));
  return { kind, options, taken: [], picksLeft: info.picks };
}

/** Runs saved before the shop rework stored `shop` as a plain array. */
export function normalizeRun<T extends RunState | Omit<RunState, 'rng'>>(state: T): T {
  const s = state as T & { shop: unknown };
  if (Array.isArray(s.shop)) {
    s.shop = { cards: s.shop as ShopItem[], packs: [], perk: null, rerollCost: RULES.rerollBaseCost, interest: 0 };
  }
  s.perks ??= [];
  s.pack ??= null;
  s.forge ??= 0;
  s.palier ??= 1;
  s.bossRerollAct ??= 0;
  s.won ??= (s.mode ?? 'deck') === 'deck' && s.level >= RULES.acts.winAct * RULES.acts.length;
  if (s.nextBoss === undefined) {
    const act = Math.floor(s.level / RULES.acts.length) + 1;
    const pool = bossPool(act, null);
    s.nextBoss = (s.mode ?? 'deck') === 'deck' ? pool[act % pool.length]! : null;
  }
  return state;
}
