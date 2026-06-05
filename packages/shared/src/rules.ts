import type { GameMode } from './engine/types.js';

/** Game balance constants. Everything tunable lives here. */
export const RULES = {
  player: { maxHp: 1000, damage: 200, critChance: 1, critDamage: 50 },
  enemy: { baseHp: 400, baseDamage: 100, bossHpMultiplier: 2, bossDamageMultiplier: 1.25 },
  bossEvery: 5,
  /** Deck mode: the shop opens once per act, after the boss. */
  shopEvery: 10,
  healCost: 5,
  goldPerKill: 1,
  bossGoldBonus: 3,
  /** Deck mode: an act is 10 stages — elite at 5, effect boss at 10. Beating act `winAct` wins the run. */
  acts: {
    length: 10,
    eliteAt: 5,
    winAct: 8,
    eliteHp: 1.8,
    eliteDamage: 1,
    /** Bosses: lots of HP, hits no harder than an elite — long, readable fights. */
    bossHp: 3.6,
    bossDamage: 1,
    /** Enemies get this much tougher per stage inside an act. */
    rampPerStage: 0.05,
    /** Enemy damage grows as scale^damageExponent (player HP grows slower than damage). */
    damageExponent: 0.5,
    /** Endless mode (after winAct): each act multiplies the scale by endlessGrowth + endlessAccel × acts past. */
    endlessGrowth: 2,
    endlessAccel: 0.15,
    /** No single enemy hit can take more than this share of the player's max HP. */
    maxHitPercent: 30,
    /** Entering a boss fight restores this share of max HP (no death by attrition at the climax). */
    bossRestPercent: 30,
    /** "Sursis": once per boss fight, a lethal hit leaves 1 HP if the boss is below this share of HP. */
    clutchBossHpPercent: 25,
    /** Swapping the announced boss in the shop (once per act): base + perAct × act. */
    bossRerollBase: 6,
    bossRerollPerAct: 2,
    eliteGold: 3,
    /** Beating the act-8 boss: a guaranteed chest of top-tier cases, plus gold for the endless mode. */
    victoryChest: ['prisma', 'red', 'red'] as const,
    victoryGold: 15,
    /** Boss passives in deck mode: Rage/Vitality give +passivePercent × √copies %, Regen heals regenPercent per copy after each kill. */
    passivePercent: 15,
    regenPercent: 6,
    regenCap: 18,
    /** Deck mode: crit chance stops here; every point above becomes crit damage. */
    critCap: 75,
    bossGold: 5,
    /** Income and prices rise with the acts: +1 gold per kill every 2 acts, heal +1 per act. */
    goldEveryActs: 3,
    healCostPerAct: 2,
  },
  /** Interest when a shop opens: +1 gold per `interestStep` gold held, up to `interestCap`. */
  interestStep: 5,
  interestCap: 5,
  /** Every victory restores this share of max HP (smooths the early-game RNG deaths). */
  recoveryPercent: 8,
  baseDeckSize: 5,
  maxDamageReduction: 75,
  maxTurnsPerFight: 400,
  shopCardSlots: 2,
  shopPackSlots: 2,
  rerollBaseCost: 2,
  perkPrice: 10,
  sellBackRate: 0.5,
  /** Levels (enemies defeated) that grant cases: 3, then every 10. */
  lootLevels: { first: 3, every: 10 },
  caseUpgradeChance: 0.1,
} as const;

/**
 * Enemy power per act (deck mode), acts 1 → winAct. Produced by
 * `npm run balance:calibrate` so that an average player clears each act at the
 * target rate. Mutable on purpose: the calibrator tunes it in-process.
 */
export const ACT_SCALE: number[] = [1, 1.38, 2, 2.98, 4.56, 6.32, 8.68, 11.4];

export function actOf(stage: number): number {
  return Math.max(1, Math.ceil(stage / RULES.acts.length));
}

export function actScale(act: number): number {
  const last = ACT_SCALE.length;
  if (act <= last) return ACT_SCALE[act - 1]!;
  let scale = ACT_SCALE[last - 1]!;
  for (let a = last + 1; a <= act; a++) scale *= RULES.acts.endlessGrowth + RULES.acts.endlessAccel * (a - last - 1);
  return scale;
}

export type EnemyKind = 'normal' | 'elite' | 'boss';

/** Deck: elite at 5, boss at 10 of each act. Classic keeps a plain boss every 5 stages. */
export function stageKind(stage: number, mode: GameMode): EnemyKind {
  if (mode === 'classic') return isBossStage(stage) ? 'boss' : 'normal';
  const pos = ((stage - 1) % RULES.acts.length) + 1;
  return pos === RULES.acts.length ? 'boss' : pos === RULES.acts.eliteAt ? 'elite' : 'normal';
}

export function isBossStage(stage: number): boolean {
  return stage > 0 && stage % RULES.bossEvery === 0;
}

export function isLootLevel(level: number): boolean {
  return level === RULES.lootLevels.first || (level > 0 && level % RULES.lootLevels.every === 0);
}

/** How many cases a loot level grants at most (min is always 1). */
export function maxCasesForLevel(level: number): number {
  if (level === RULES.lootLevels.first) return 5;
  if (level < 20) return 4;
  if (level < 40) return 3;
  return 2;
}

export function isLucasNumber(n: number): boolean {
  let a = 2;
  let b = 1;
  if (n === a || n === b) return true;
  while (b < n) {
    [a, b] = [b, a + b];
    if (b === n) return true;
  }
  return false;
}

export function isFactorialNumber(n: number): boolean {
  let f = 1;
  for (let i = 2; f < n; i++) f *= i;
  return f === n && n >= 1;
}

/**
 * Difficulty tiers (deck mode). Winning a run on tier N unlocks tier N+1, and
 * every tier keeps the constraints of the ones below it.
 */
export const MAX_PALIER = 8;

export const PALIERS: readonly { level: number; name: string; text: string }[] = [
  { level: 1, name: 'Palier 1', text: 'Les règles de base.' },
  { level: 2, name: 'Palier 2', text: 'Ennemis robustes : +20 % de PV pour tous les ennemis.' },
  { level: 3, name: 'Palier 3', text: 'Élites menaçantes : chaque élite applique un effet de boss, annoncé à l’avance.' },
  { level: 4, name: 'Palier 4', text: 'Bourse vide : plus aucun intérêt à la boutique.' },
  { level: 5, name: 'Palier 5', text: 'Sans répit : plus de repos avant le boss.' },
  { level: 6, name: 'Palier 6', text: 'Boss féroces : les boss frappent 25 % plus fort.' },
  { level: 7, name: 'Palier 7', text: 'Sans sursis : le Sursis ne protège plus contre le boss.' },
  { level: 8, name: 'Palier 8', text: 'Cauchemar : ennemis encore +20 % de PV et +15 % de dégâts.' },
];

export interface PalierRules {
  enemyHp: number;
  enemyDamage: number;
  bossDamage: number;
  eliteEffect: boolean;
  interest: boolean;
  bossRestPercent: number;
  clutch: boolean;
}

export function palierRules(palier = 1): PalierRules {
  const p = Math.max(1, Math.min(MAX_PALIER, Math.floor(palier)));
  return {
    enemyHp: (p >= 2 ? 1.2 : 1) * (p >= 8 ? 1.2 : 1),
    enemyDamage: p >= 8 ? 1.15 : 1,
    bossDamage: p >= 6 ? 1.25 : 1,
    eliteEffect: p >= 3,
    interest: p < 4,
    bossRestPercent: p >= 5 ? 0 : RULES.acts.bossRestPercent,
    clutch: p < 7,
  };
}
