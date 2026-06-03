import { CARDS, type Card } from './cards.js';
import { RARITIES, type Rarity } from './rarity.js';

export const CASE_IDS = ['alpha', 'bravo', 'chroma', 'delta', 'spectrum', 'clutch', 'red', 'prisma'] as const;
export type CaseId = (typeof CASE_IDS)[number];

export interface CaseType {
  id: CaseId;
  name: string;
  /** Inclusive level range in which this case drops. */
  minLevel: number;
  color: string;
  /** Rarity weights, same order as RARITIES. Normalised at roll time. */
  weights: readonly number[];
}

export const CASE_TYPES: readonly CaseType[] = [
  { id: 'alpha', name: 'Alpha Case', minLevel: 0, color: '#6b7a8f', weights: [45.908, 33.932, 16.467, 1.996, 0.898, 0.499, 0.299] },
  { id: 'bravo', name: 'Bravo Case', minLevel: 40, color: '#4f7cac', weights: [44.879, 33.263, 17.951, 2.112, 0.95, 0.528, 0.317] },
  { id: 'chroma', name: 'Chroma Case', minLevel: 50, color: '#3fa7a0', weights: [38.461, 31.468, 21.145, 5.331, 2.662, 0.583, 0.35] },
  { id: 'delta', name: 'Delta Case', minLevel: 60, color: '#6c5ce7', weights: [28.867, 24.744, 21.682, 12.856, 7.011, 4.325, 0.515] },
  { id: 'spectrum', name: 'Spectrum Case', minLevel: 70, color: '#a55eea', weights: [26.316, 22.632, 21.105, 14.684, 7.895, 5.411, 1.958] },
  { id: 'clutch', name: 'Clutch Case', minLevel: 80, color: '#e17055', weights: [21.534, 19.497, 18.436, 24.351, 8.324, 5.623, 2.214] },
  { id: 'red', name: 'Red Case', minLevel: 90, color: '#d63031', weights: [19.08, 18.133, 17.091, 27.553, 9.074, 6.361, 2.701] },
  { id: 'prisma', name: 'Prisma Edition', minLevel: 100, color: '#fdcb6e', weights: [10.725, 10.291, 14.136, 36.069, 14.18, 11.343, 3.268] },
];

export const CASE_BY_ID: ReadonlyMap<CaseId, CaseType> = new Map(CASE_TYPES.map((c) => [c.id, c]));

export function isCaseId(value: string): value is CaseId {
  return (CASE_IDS as readonly string[]).includes(value);
}

export function caseTypeForLevel(level: number): CaseType {
  let found = CASE_TYPES[0]!;
  for (const c of CASE_TYPES) if (level >= c.minLevel) found = c;
  return found;
}

/** Probability (0..1) of each rarity for a case, normalised so it always sums to 1. */
export function rarityOdds(caseType: CaseType): Record<Rarity, number> {
  const total = caseType.weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(RARITIES.map((r, i) => [r, (caseType.weights[i] ?? 0) / total])) as Record<Rarity, number>;
}

/** Pick a rarity then a card uniformly inside it. `random` must return a float in [0, 1). */
export function rollCase(caseType: CaseType, random: () => number): Card {
  const odds = rarityOdds(caseType);
  let roll = random();
  let rarity: Rarity = RARITIES[0];
  for (const r of RARITIES) {
    rarity = r;
    roll -= odds[r];
    if (roll < 0) break;
  }
  const pool = CARDS.filter((c) => c.rarity === rarity);
  return pool[Math.floor(random() * pool.length)] ?? CARDS[0]!;
}
