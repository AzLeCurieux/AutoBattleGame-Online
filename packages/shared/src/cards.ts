import { describeEffect, type CardEffect } from './effects.js';
import type { Rarity } from './rarity.js';

export interface CardDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  effects: readonly CardEffect[];
}

export interface Card extends CardDefinition {
  description: string;
}

const defs: CardDefinition[] = [
  // Consumer
  { id: 'andres_everest', name: 'Andres Everest', rarity: 'consumer', effects: [{ kind: 'damagePerLevels', value: 3, interval: 1 }] },
  { id: 'aurelien_dofus', name: 'Aurelien Dofus', rarity: 'consumer', effects: [{ kind: 'flatHealth', value: 150 }] },
  { id: 'axel_bruce_wayne', name: 'Axel Bruce Wayne', rarity: 'consumer', effects: [{ kind: 'flatCritChance', value: 12 }, { kind: 'flatCritDamage', value: 30 }] },
  { id: 'complet', name: 'Complet', rarity: 'consumer', effects: [{ kind: 'damageReduction', value: 8 }] },
  { id: 'gagou_fornite', name: 'Gagou Fornite', rarity: 'consumer', effects: [{ kind: 'percentDamage', value: 10 }] },
  { id: 'glamal_basket', name: 'Glamal Basket', rarity: 'consumer', effects: [{ kind: 'damagePerLevels', value: 15, interval: 5 }] },
  { id: 'glamal_csgo', name: 'Glamal CSGO', rarity: 'consumer', effects: [{ kind: 'flatCritDamage', value: 35 }] },
  { id: 'glamal_neige', name: 'Glamal Neige', rarity: 'consumer', effects: [{ kind: 'percentHealth', value: 12 }] },
  { id: 'ibra_kart', name: 'Ibra Kart', rarity: 'consumer', effects: [{ kind: 'goldPerKill', value: 1 }] },
  { id: 'kilian_garden', name: 'Kilian Garden', rarity: 'consumer', effects: [{ kind: 'healOnKill', value: 8 }] },
  { id: 'kilian_pokemon', name: 'Kilian Pokemon', rarity: 'consumer', effects: [{ kind: 'bonusDamageChance', value: 60, chance: 25 }] },
  { id: 'lucas_lucarton', name: 'Lucas Lucarton', rarity: 'consumer', effects: [{ kind: 'flatHealth', value: 80 }] },
  { id: 'quentin_fish', name: 'Quentin Fish', rarity: 'consumer', effects: [{ kind: 'lifesteal', value: 4, chance: 50 }] },
  // Industrial
  { id: 'axel_batman', name: 'Axel Batman', rarity: 'industrial', effects: [{ kind: 'damageReduction', value: 12 }] },
  { id: 'axel_mugshot', name: 'Axel Mugshot', rarity: 'industrial', effects: [{ kind: 'flatCritDamage', value: 40 }] },
  { id: 'glamal_onsen', name: 'Glamal Onsen', rarity: 'industrial', effects: [{ kind: 'healOnKill', value: 6 }] },
  { id: 'glamal_pirate', name: 'Glamal Pirate', rarity: 'industrial', effects: [{ kind: 'lifesteal', value: 3 }] },
  { id: 'iut', name: 'IUT', rarity: 'industrial', effects: [{ kind: 'flatHealth', value: 200 }] },
  { id: 'lucas_canada', name: 'Lucas Canada', rarity: 'industrial', effects: [{ kind: 'percentDamage', value: 8 }, { kind: 'damageOnLucasLevel', value: 30 }] },
  // Mil-Spec
  { id: 'aurelien_bob', name: 'Aurelien Bob', rarity: 'milspec', effects: [{ kind: 'bonusDamageChance', value: 250, chance: 30 }] },
  { id: 'glamal_fiak', name: 'Glamal Fiak', rarity: 'milspec', effects: [{ kind: 'percentDamageChance', value: 60, chance: 30 }, { kind: 'damageOnFactorialLevel', value: 100 }] },
  { id: 'glamal_voiture', name: 'Glamal Voiture', rarity: 'milspec', effects: [{ kind: 'doubleStrikeChance', value: 25 }] },
  { id: 'lucas_voiture', name: 'Lucas Voiture', rarity: 'milspec', effects: [{ kind: 'comboDamage', value: 20, max: 80 }] },
  { id: 'quentin_pokemon', name: 'Quentin Pokemon', rarity: 'milspec', effects: [{ kind: 'flatCritChance', value: 6 }, { kind: 'critPerCaseFound', value: 1 }] },
  // Restricted
  { id: 'andres_boite', name: 'Andres Boite', rarity: 'restricted', effects: [{ kind: 'reflect', value: 40 }] },
  { id: 'andres_urgence', name: 'Andres Urgence', rarity: 'restricted', effects: [{ kind: 'damageBelowHalfHealth', value: 60 }] },
  { id: 'aurelien_maxeed', name: 'Aurelien Maxeed', rarity: 'restricted', effects: [{ kind: 'percentDamageChance', value: 45, chance: 40 }] },
  { id: 'glamal_men_in_black', name: 'Glamal Men In Black', rarity: 'restricted', effects: [{ kind: 'flatCritChance', value: 12 }, { kind: 'flatCritDamage', value: 30 }] },
  { id: 'kilian_obelix', name: 'Kilian Obelix', rarity: 'restricted', effects: [{ kind: 'damageReduction', value: 18 }] },
  { id: 'kilian_red', name: 'Kilian Red', rarity: 'restricted', effects: [{ kind: 'lifesteal', value: 6 }] },
  // Classified
  { id: 'all_squad', name: 'All Squad', rarity: 'classified', effects: [{ kind: 'flatCritChance', value: 8 }, { kind: 'critPerEmptySlot', value: 6 }] },
  { id: 'andres_m8', name: 'Andres M8', rarity: 'classified', effects: [{ kind: 'bossDamage', value: 30 }] },
  { id: 'aurelien_dragon', name: 'Aurelien Dragon', rarity: 'classified', effects: [{ kind: 'percentDamage', value: 12 }, { kind: 'damagePerEmptySlot', value: 8 }] },
  { id: 'glamal_location', name: 'Glamal Location', rarity: 'classified', effects: [{ kind: 'percentDamage', value: 10 }, { kind: 'execute', threshold: 30 }] },
  { id: 'kilian_enceinte', name: 'Kilian Enceinte', rarity: 'classified', effects: [{ kind: 'revive', healthPercent: 35 }] },
  // Covert
  { id: 'andres_tartinex', name: 'Andres Tartinex', rarity: 'covert', effects: [{ kind: 'percentDamage', value: 15 }, { kind: 'damageIfSmallDeck', value: 25, maxCards: 4 }] },
  { id: 'aurelien_lfi', name: 'Aurelien LFI', rarity: 'covert', effects: [{ kind: 'dodge', value: 22 }] },
  { id: 'axel_potion', name: 'Axel Potion', rarity: 'covert', effects: [{ kind: 'healOnKill', value: 15 }] },
  { id: 'complet_grill', name: 'Complet Grill', rarity: 'covert', effects: [{ kind: 'damageReduction', value: 10 }, { kind: 'reflect', value: 60 }] },
  { id: 'glamal_panart', name: 'Glamal Panart', rarity: 'covert', effects: [{ kind: 'percentDamage', value: 80 }, { kind: 'flatCritChance', value: -100 }] },
  { id: 'lucas_cheval', name: 'Lucas Cheval', rarity: 'covert', effects: [{ kind: 'dodge', value: 10 }, { kind: 'critAfterDodge', value: 100 }] },
  { id: 'lucas_dust', name: 'Lucas Dust', rarity: 'covert', effects: [{ kind: 'execute', threshold: 40 }] },
  { id: 'quentin_drake', name: 'Quentin Drake', rarity: 'covert', effects: [{ kind: 'bossDamage', value: 90 }, { kind: 'flatCritChance', value: -25 }] },
  { id: 'quentin_nostonks', name: 'Quentin Nostonks', rarity: 'covert', effects: [{ kind: 'percentDamage', value: 15 }, { kind: 'damageBelowHalfHealth', value: 80 }] },
  { id: 'quentin_potion', name: 'Quentin Potion', rarity: 'covert', effects: [{ kind: 'healOnKillPerGold', value: 1, max: 30 }] },
  // Gold
  { id: 'andres_gold', name: 'Andres Gold', rarity: 'melee', effects: [{ kind: 'critPerGold', value: 1 }] },
  { id: 'aurelien_yellow_army', name: 'Aurelien Yellow Army', rarity: 'melee', effects: [{ kind: 'bossDamage', value: 50 }] },
  { id: 'glamal_cs_gold', name: 'Glamal CS Gold', rarity: 'melee', effects: [{ kind: 'baseDamageMultiplierPerLevels', multiplier: 1.25, interval: 20 }] },
  { id: 'lucas_totem', name: 'Lucas Totem', rarity: 'melee', effects: [{ kind: 'revive', healthPercent: 100, bonusMaxHealthPercent: 50 }] },
  { id: 'quentin_sonic', name: 'Quentin Sonic', rarity: 'melee', effects: [{ kind: 'dodge', value: 25 }] },
];

export const CARDS: readonly Card[] = defs.map((def) => ({
  ...def,
  description: def.effects.map(describeEffect).join(', '),
}));

export const CARDS_BY_ID: ReadonlyMap<string, Card> = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): Card | undefined {
  return CARDS_BY_ID.get(id);
}

export function cardsOfRarity(rarity: Rarity): Card[] {
  return CARDS.filter((c) => c.rarity === rarity);
}
