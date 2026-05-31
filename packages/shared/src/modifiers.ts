import type { CardEffect } from './effects.js';
import { describeEffect } from './effects.js';
import type { ModifierId } from './engine/types.js';

export interface ModifierInfo {
  id: ModifierId;
  label: string;
  /** Probability (0..1) that a shop card rolls this modifier. */
  chance: number;
  priceMultiplier: number;
  effect: CardEffect | null;
  extraDeckSlots: number;
  description: string;
}

const raw: Omit<ModifierInfo, 'description'>[] = [
  { id: 'negative', label: 'Negative', chance: 0.01, priceMultiplier: 3, effect: null, extraDeckSlots: 1 },
  { id: 'polychrome', label: 'Polychrome', chance: 0.02, priceMultiplier: 2.5, effect: { kind: 'flatCritChance', value: 1.5 }, extraDeckSlots: 0 },
  { id: 'holographic', label: 'Holographic', chance: 0.08, priceMultiplier: 1.8, effect: { kind: 'flatCritDamage', value: 5 }, extraDeckSlots: 0 },
  { id: 'foil', label: 'Foil', chance: 0.1, priceMultiplier: 1.5, effect: { kind: 'flatDamage', value: 30 }, extraDeckSlots: 0 },
];

export const MODIFIERS: readonly ModifierInfo[] = raw.map((m) => ({
  ...m,
  description: m.effect ? describeEffect(m.effect) : `+${m.extraDeckSlots} emplacement de deck`,
}));

export const MODIFIER_BY_ID: ReadonlyMap<ModifierId, ModifierInfo> = new Map(MODIFIERS.map((m) => [m.id, m]));
