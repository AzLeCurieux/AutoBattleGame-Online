export const RARITIES = [
  'consumer',
  'industrial',
  'milspec',
  'restricted',
  'classified',
  'covert',
  'melee',
] as const;

export type Rarity = (typeof RARITIES)[number];

export interface RarityInfo {
  label: string;
  color: string;
  /** Base price in the in-run shop (gold). */
  shopPrice: number;
}

/** Single source of truth for rarity metadata (the old code had 3 diverging copies). */
export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  consumer: { label: 'Consumer', color: '#b0c3d9', shopPrice: 3 },
  industrial: { label: 'Industrial', color: '#5e98d9', shopPrice: 4 },
  milspec: { label: 'Mil-Spec', color: '#4b69ff', shopPrice: 5 },
  restricted: { label: 'Restricted', color: '#8847ff', shopPrice: 7 },
  classified: { label: 'Classified', color: '#d32ce6', shopPrice: 9 },
  covert: { label: 'Covert', color: '#eb4b4b', shopPrice: 11 },
  melee: { label: 'Gold', color: '#e4ae39', shopPrice: 14 },
};
