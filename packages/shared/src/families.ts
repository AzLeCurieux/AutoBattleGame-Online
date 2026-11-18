import type { CardEffect } from './effects.js';

/**
 * Every card shows one of the friends. Holding several cards of the same
 * friend in the deck unlocks a growing team bonus (2, 3 and 4 cards).
 */
export const FAMILY_IDS = ['glamal', 'lucas', 'andres', 'aurelien', 'axel', 'kilian', 'quentin'] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

export interface FamilyInfo {
  id: FamilyId;
  name: string;
  /** What the bonus does, with {v} replaced by the value of the current tier. */
  text: string;
  /** Bonus for 2, 3 and 4+ cards. */
  tiers: readonly [CardEffect, CardEffect, CardEffect];
}

const tiers = (kind: 'flatCritChance' | 'percentDamage' | 'bossDamage' | 'dodge' | 'damageReduction' | 'lifesteal' | 'flatCritDamage', values: [number, number, number]) =>
  values.map((value) => ({ kind, value }) as CardEffect) as unknown as readonly [CardEffect, CardEffect, CardEffect];

export const FAMILIES: Record<FamilyId, FamilyInfo> = {
  glamal: { id: 'glamal', name: 'Clan Glamal', text: '+{v} % de chance critique', tiers: tiers('flatCritChance', [5, 10, 16]) },
  lucas: { id: 'lucas', name: 'Clan Lucas', text: '+{v} % de dégâts', tiers: tiers('percentDamage', [8, 16, 26]) },
  andres: { id: 'andres', name: 'Clan Andres', text: '+{v} % de dégâts contre les boss', tiers: tiers('bossDamage', [15, 30, 50]) },
  aurelien: { id: 'aurelien', name: 'Clan Aurélien', text: '+{v} % d’esquive', tiers: tiers('dodge', [4, 8, 13]) },
  axel: { id: 'axel', name: 'Clan Axel', text: '-{v} % de dégâts reçus', tiers: tiers('damageReduction', [5, 10, 16]) },
  kilian: { id: 'kilian', name: 'Clan Kilian', text: 'Vol de vie {v} %', tiers: tiers('lifesteal', [2, 4, 7]) },
  quentin: { id: 'quentin', name: 'Clan Quentin', text: '+{v} % de dégâts critiques', tiers: tiers('flatCritDamage', [20, 40, 70]) },
};

export function familyOf(cardId: string): FamilyId | null {
  const prefix = cardId.split('_')[0] as FamilyId;
  return cardId.includes('_') && prefix in FAMILIES ? prefix : null;
}

export interface ActiveFamily {
  family: FamilyInfo;
  count: number;
  /** 0 = not active yet (1 card), 1..3 = tier reached. */
  tier: number;
  effect: CardEffect | null;
}

/** Families present in a deck, strongest first. */
export function deckFamilies(cardIds: readonly string[]): ActiveFamily[] {
  const counts = new Map<FamilyId, number>();
  for (const id of cardIds) {
    const f = familyOf(id);
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, count]) => {
      const tier = Math.min(3, Math.max(0, count - 1));
      return { family: FAMILIES[id], count, tier, effect: tier > 0 ? FAMILIES[id].tiers[tier - 1]! : null };
    })
    .sort((a, b) => b.count - a.count);
}

/** Bonus text of a tier (1..3), e.g. "+10 % de chance critique". */
export const familyText = (f: FamilyInfo, tier: number) => f.text.replace('{v}', String((f.tiers[Math.min(2, Math.max(0, tier - 1))] as { value: number }).value));
