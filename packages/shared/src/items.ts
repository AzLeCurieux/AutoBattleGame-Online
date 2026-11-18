import type { ItemId } from './engine/types.js';

export interface ItemInfo {
  id: ItemId;
  name: string;
  text: string;
  price: number;
}

/** Items held at once. */
export const MAX_ITEMS = 3;

export const ITEMS: Record<ItemId, ItemInfo> = {
  potion: { id: 'potion', name: 'Potion', text: 'Rend 50 % des PV max.', price: 4 },
  whetstone: { id: 'whetstone', name: 'Pierre à aiguiser', text: '+50 % de dégâts pendant le prochain combat.', price: 5 },
  shield: { id: 'shield', name: 'Bouclier', text: '-40 % de dégâts reçus pendant le prochain combat.', price: 5 },
  luckyCoin: { id: 'luckyCoin', name: 'Pièce porte-bonheur', text: 'Double l’or du prochain combat gagné.', price: 3 },
  prism: { id: 'prism', name: 'Prisme', text: 'Une carte du deck sans édition en reçoit une (Foil, Holographic ou Polychrome).', price: 6 },
  compass: { id: 'compass', name: 'Boussole', text: 'Relance les choix de la prochaine étape.', price: 3 },
};
