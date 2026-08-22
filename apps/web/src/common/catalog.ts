/**
 * Display metadata copied from v1 (js/loot/lootData.js, js/cards/CardSystem.js,
 * js/loot/LootBoxSystem.js, js/shop/CardShop.js) so every screen shows the same
 * names, colours, images and texts as before. Game rules live in @autobattle/shared.
 */
import { CARDS_BY_ID, describeEffect, RARITIES, type CaseId, type ModifierId, type Rarity } from '@autobattle/shared';

/** LOOT_CONFIG.categories — used by the gambling and inventory pages. */
export const LOOT_CATEGORIES: Record<Rarity, { name: string; color: string }> = {
  consumer: { name: 'Consumer Grade', color: '#b0c3d9' },
  industrial: { name: 'Industrial Grade', color: '#5e98d9' },
  milspec: { name: 'Mil-spec', color: '#4b69ff' },
  restricted: { name: 'Restricted', color: '#8847ff' },
  classified: { name: 'Classified', color: '#d32ce6' },
  covert: { name: 'Covert', color: '#eb4b4b' },
  melee: { name: 'Melee / Gold', color: '#e4ae39' },
};

/** CardSystem.getRarityColor / CardShop.getRarityColor — used in game (deck, shop). */
export const CARD_COLORS: Record<Rarity, string> = {
  consumer: '#b0c3d9',
  industrial: '#5e98d9',
  milspec: '#4b69ff',
  restricted: '#8a3883',
  classified: '#e506bc',
  covert: '#eb4b4b',
  melee: '#e4ae39',
};

/** lootData item value per rarity. */
const RARITY_VALUE: Record<Rarity, number> = {
  consumer: 10,
  industrial: 25,
  milspec: 75,
  restricted: 250,
  classified: 1000,
  covert: 5000,
  melee: 20000,
};

export interface CardMeta {
  id: string;
  name: string;
  rarity: Rarity;
  rarityName: string;
  image: string;
  value: number;
  /** All effects joined on one line. */
  effect: string;
  /** One line per effect, generated from the engine data. */
  effects: string[];
  /** "**Name** apparaît !" in v1. */
  text: string;
}

export function cardMeta(cardId: string): CardMeta | undefined {
  const card = CARDS_BY_ID.get(cardId);
  if (!card) return undefined;
  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    rarityName: LOOT_CATEGORIES[card.rarity].name,
    // Files are named "<rarity index>_<card id>.png" in /img/cartes.
    image: `${RARITIES.indexOf(card.rarity) + 1}_${card.id}.png`,
    value: RARITY_VALUE[card.rarity],
    // Generated from the effect data, so the text always matches what the engine does.
    effect: card.description,
    effects: card.effects.map(describeEffect),
    text: `${card.name} apparaît !`,
  };
}

export interface CaseMeta {
  id: CaseId;
  /** Full v1 name, e.g. "Alpha Case (1-39)". */
  name: string;
  levelRange: [number, number];
  image: string;
  imageLarge: string;
  /** LootBoxSystem.getCaseColor (loot notifications). */
  color: string;
}

const CASES: CaseMeta[] = [
  { id: 'alpha', name: 'Alpha Case (1-39)', levelRange: [1, 39], file: 'alpha_case', color: '#a0a0a0' },
  { id: 'bravo', name: 'Bravo Case (40-49)', levelRange: [40, 49], file: 'bravo_case', color: '#6b8cae' },
  { id: 'chroma', name: 'Chroma Case (50-59)', levelRange: [50, 59], file: 'chroma_case', color: '#5d76cb' },
  { id: 'delta', name: 'Delta case (60-69)', levelRange: [60, 69], file: 'delta_case', color: '#8a6bbd' },
  { id: 'spectrum', name: 'Spectrum Case (70-79)', levelRange: [70, 79], file: 'spectrum_case', color: '#c54bc9' },
  { id: 'clutch', name: 'Clutch Case (80-89)', levelRange: [80, 89], file: 'clutch_case', color: '#d74b4b' },
  { id: 'red', name: 'Red Case (90-99)', levelRange: [90, 99], file: 'red_case', color: '#eb4b4b' },
  { id: 'prisma', name: 'Prisma Edition (100+)', levelRange: [100, 999], file: 'prisma_edition', color: '#d4af37' },
].map(({ file, ...c }) => ({
  ...c,
  id: c.id as CaseId,
  levelRange: c.levelRange as [number, number],
  image: `/img/case/Caisse_icons/${file}.png`,
  imageLarge: `/img/case/Caisse_trimmed/${file}.png`,
}));

export const CASE_META = new Map<string, CaseMeta>(CASES.map((c) => [c.id, c]));
export const CASE_ORDER: readonly string[] = CASES.map((c) => c.id);

export function caseMeta(caseId: string): CaseMeta {
  return CASE_META.get(caseId) ?? CASES[0]!;
}

/** CardModifiers.js */
export const MODIFIER_META: Record<ModifierId, { name: string; description: string; cssClass: string }> = {
  foil: { name: 'Foil', description: '+30 dégâts', cssClass: 'card-foil' },
  holographic: { name: 'Holographic', description: '+5% dégâts critiques', cssClass: 'card-holographic' },
  polychrome: { name: 'Polychrome', description: '+1.5% chance critique', cssClass: 'card-polychrome' },
  negative: { name: 'Negative', description: 'Bypasse la limite de deck', cssClass: 'card-negative' },
};
