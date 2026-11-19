import { getCard } from '../cards.js';
import type { CardEffect } from '../effects.js';
import { deckFamilies } from '../families.js';
import { MODIFIER_BY_ID } from '../modifiers.js';
import type { BossId } from '../bosses.js';
import { RULES, actOf, actScale, palierRules, stageKind, type EnemyKind } from '../rules.js';
import type { BossPassive, DeckCard, EnemyInfo, GameMode, PerkId, RunState } from './types.js';

/**
 * Flatten every effect of the deck (cards + modifiers) into one list. Each
 * effect remembers the deck slot it comes from (`srcOf`), so the combat log can
 * say exactly which card triggered.
 */
export function deckEffects(deck: readonly DeckCard[], silenced = -1): CardEffect[] {
  const effects: CardEffect[] = [];
  for (const [i, entry] of deck.entries()) {
    if (i === silenced) continue;
    const card = getCard(entry.cardId);
    if (card) for (const e of card.effects) effects.push(Object.assign(starred(e, entry.stars ?? 1), { src: i }));
    const mod = entry.modifier ? MODIFIER_BY_ID.get(entry.modifier) : undefined;
    if (mod?.effect) effects.push(Object.assign({}, mod.effect, { src: i }));
  }
  // Team bonuses (several cards of the same friend). FAMILY_SRC: not a deck slot.
  const ids = deck.filter((_, i) => i !== silenced).map((d) => d.cardId);
  for (const f of deckFamilies(ids)) if (f.effect) effects.push(Object.assign({}, f.effect, { src: FAMILY_SRC }));
  return effects;
}

/** `src` of the effects granted by a team bonus. */
export const FAMILY_SRC = -2;

/** Each fusion star adds 50 % to the card's positive values (and caps). Drawbacks are not amplified. */
export const STAR_BONUS = 0.5;
export function starred(e: CardEffect, stars: number): CardEffect {
  if (stars <= 1) return { ...e };
  const k = 1 + STAR_BONUS * (stars - 1);
  const out = { ...e } as CardEffect & { value?: number; max?: number; threshold?: number; healthPercent?: number };
  if (typeof out.value === 'number' && out.value > 0) out.value = Math.round(out.value * k * 100) / 100;
  if (typeof out.max === 'number') out.max = Math.round(out.max * k);
  if (typeof out.threshold === 'number') out.threshold = Math.min(60, Math.round(out.threshold * (1 + (k - 1) / 2)));
  if (typeof out.healthPercent === 'number') out.healthPercent = Math.min(100, Math.round(out.healthPercent * k));
  return out;
}

/** Deck slot an effect from `deckEffects` comes from (-1 if unknown). */
export const srcOf = (e: CardEffect): number => (e as CardEffect & { src?: number }).src ?? -1;

export function deckLimit(deck: readonly DeckCard[], perks: readonly PerkId[] = []): number {
  const limit = RULES.baseDeckSize + (perks.includes('satchel') ? 1 : 0);
  // Only one Negative extends the deck: stacking them made decks too wide.
  let extra = 0;
  for (const entry of deck) extra = Math.max(extra, entry.modifier ? (MODIFIER_BY_ID.get(entry.modifier)?.extraDeckSlots ?? 0) : 0);
  return limit + extra;
}

const sum = (effects: CardEffect[], kind: CardEffect['kind']) =>
  effects.reduce((acc, e) => (e.kind === kind && 'value' in e ? acc + e.value : acc), 0);

const ofKind = <K extends CardEffect['kind']>(effects: CardEffect[], kind: K) =>
  effects.filter((e): e is Extract<CardEffect, { kind: K }> => e.kind === kind);

export interface EffectiveStats {
  maxHp: number;
  /** Attack before per-hit conditional bonuses. */
  attack: number;
  critChance: number;
  critDamage: number;
  damageReduction: number;
  dodge: number;
  emptySlots: number;
}

/**
 * What the boss passives give. Copies stack with diminishing returns (square root).
 * - Classic: flat stats after every victory (the original rules).
 * - Deck: a permanent percentage, no per-kill growth — a Rage picked at act 1
 *   used to be worth +1000 damage by act 8, the main snowball of the game.
 */
export function passivePower(passives: readonly BossPassive[], mode: GameMode = 'deck') {
  const count = (p: BossPassive) => passives.filter((x) => x === p).length;
  if (mode === 'classic') {
    return {
      damage: Math.round(8 * Math.sqrt(count('rage'))),
      maxHp: Math.round(18 * Math.sqrt(count('vitality'))),
      healPercent: Math.min(30, 10 * count('regen')),
      damagePercent: 0,
      hpPercent: 0,
      goldPerKill: 0,
    };
  }
  const { passivePercent, regenPercent, regenCap } = RULES.acts;
  const root = (p: BossPassive) => Math.sqrt(count(p));
  // Pacts: a stronger bonus paid with a drawback (see PASSIVE_RULES).
  const P = PASSIVE_RULES;
  return {
    damage: 0,
    maxHp: 0,
    healPercent: Math.min(regenCap, regenPercent * count('regen')),
    damagePercent: Math.round(passivePercent * root('rage') + P.fury.bonus * root('fury') - P.bulwark.malus * root('bulwark') - P.greed.malus * root('greed')),
    hpPercent: Math.round(passivePercent * root('vitality') + P.bulwark.bonus * root('bulwark') - P.fury.malus * root('fury')),
    goldPerKill: P.greed.bonus * count('greed'),
  };
}

/** Stats shown in the UI and used at the start of every hit. */
export function computeStats(
  run: Pick<RunState, 'base' | 'deck' | 'level' | 'gold' | 'casesFound' | 'critUpgrades'> & {
    perks?: readonly PerkId[];
    forge?: number;
    bossPassives?: readonly BossPassive[];
    mode?: GameMode;
  },
  stage = run.level + 1,
  /** Index of a deck card disabled for this fight (boss "Le Muet"). */
  silenced = -1,
): EffectiveStats {
  const fx = deckEffects(run.deck, silenced);
  const emptySlots = Math.max(0, deckLimit(run.deck, run.perks ?? []) - run.deck.length);

  const deckMode = (run.mode ?? 'deck') === 'deck';
  const power = passivePower(run.bossPassives ?? [], run.mode ?? 'deck');
  const maxHp = Math.floor(
    (run.base.maxHp + sum(fx, 'flatHealth') + (run.base.maxHp * sum(fx, 'percentHealth')) / 100) * (1 + power.hpPercent / 100),
  );

  let attack = run.base.damage + sum(fx, 'flatDamage');
  for (const e of ofKind(fx, 'baseDamageMultiplierPerLevels')) {
    attack *= Math.pow(e.multiplier, Math.floor(stage / e.interval));
  }
  for (const e of ofKind(fx, 'damagePerLevels')) attack += e.value * Math.floor(stage / e.interval);
  attack *= (1 + FORGE_BONUS * (run.forge ?? 0)) * (1 + power.damagePercent / 100);

  const critChance =
    run.base.critChance +
    sum(fx, 'flatCritChance') +
    sum(fx, 'critPerCaseFound') * run.casesFound +
    sum(fx, 'critPerGold') * run.gold +
    sum(fx, 'critPerEmptySlot') * emptySlots;

  // Crit chance above the cap is not wasted: each extra point becomes crit damage.
  const cap = deckMode ? RULES.acts.critCap : 100;
  const overflow = Math.max(0, critChance - cap);

  return {
    maxHp,
    attack: Math.floor(attack + 1e-6), // 200 × 1.15 must give 230, not 229.99…
    critChance: clamp(critChance, 0, cap),
    critDamage: Math.round(run.base.critDamage + sum(fx, 'flatCritDamage') + overflow * CRIT_OVERFLOW_RATE),
    damageReduction: clamp(sum(fx, 'damageReduction'), 0, RULES.maxDamageReduction),
    dodge: clamp(sum(fx, 'dodge'), 0, 90),
    emptySlots,
  };
}

export const FORGE_BONUS = 0.08;
export const CRIT_OVERFLOW_RATE = 2;

/**
 * Index of the card "Le Muet" disables: the first one of the deck. The player
 * chooses which card that is by reordering the deck — a counter they control.
 */
export function silencedIndex(deck: readonly DeckCard[]): number {
  return deck.length > 0 ? 0 : -1;
}

/**
 * Pacts (deck mode): % bonus and % drawback per copy (√ stacking like the
 * others). Greed's bonus is gold per kill, its drawback is damage.
 */
export const PASSIVE_RULES = {
  fury: { bonus: 30, malus: 15 },
  bulwark: { bonus: 30, malus: 12 },
  greed: { bonus: 2, malus: 10 },
} as const;

export function createEnemy(level: number, mode: GameMode = 'classic', bossId: BossId | null = null, palier = 1, kindOverride?: EnemyKind): EnemyInfo {
  const stage = level + 1;
  const kind = kindOverride ?? stageKind(stage, mode);
  const act = actOf(stage);

  if (mode === 'classic') {
    // Legacy smooth curve, plain boss every 5 stages.
    const hp = Math.floor(RULES.enemy.baseHp + 10 * level * Math.pow(1.05, level));
    const dmg = Math.floor(2 * level + RULES.enemy.baseDamage * Math.pow(1.02, level));
    const isBoss = kind === 'boss';
    return {
      stage,
      act,
      kind,
      bossId: null,
      isBoss,
      maxHp: isBoss ? hp * RULES.enemy.bossHpMultiplier : hp,
      damage: isBoss ? Math.floor(dmg * RULES.enemy.bossDamageMultiplier) : dmg,
    };
  }

  const A = RULES.acts;
  const pos = (stage - 1) % A.length;
  const scale = actScale(act) * (1 + A.rampPerStage * pos);
  const tier = palierRules(palier);
  // Bosses always carry their effect; elites only from the tier that says so.
  const effect = kind === 'boss' || (kind === 'elite' && tier.eliteEffect) ? bossId : null;
  let hp = RULES.enemy.baseHp * scale * tier.enemyHp;
  let dmg = RULES.enemy.baseDamage * Math.pow(scale, A.damageExponent) * tier.enemyDamage;
  if (kind === 'elite') {
    hp *= A.eliteHp;
    dmg *= A.eliteDamage;
  } else if (kind === 'boss') {
    hp *= A.bossHp;
    dmg *= A.bossDamage * tier.bossDamage;
  }
  if (effect === 'colossus') hp *= 1.3;
  return { stage, act, kind, bossId: effect, isBoss: kind === 'boss', maxHp: Math.floor(hp), damage: Math.floor(dmg) };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export { ofKind, sum as sumEffect };
