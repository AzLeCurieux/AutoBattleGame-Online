/**
 * Card effects as data. Every effect the engine understands is listed here,
 * and its French description is derived from the data, so the text shown to
 * players can never drift from what the engine actually does.
 */
export type CardEffect =
  | { kind: 'flatDamage'; value: number }
  | { kind: 'percentDamage'; value: number }
  | { kind: 'flatHealth'; value: number }
  | { kind: 'percentHealth'; value: number }
  | { kind: 'flatCritChance'; value: number }
  | { kind: 'flatCritDamage'; value: number }
  | { kind: 'damageReduction'; value: number }
  | { kind: 'damagePerLevels'; value: number; interval: number }
  | { kind: 'baseDamageMultiplierPerLevels'; multiplier: number; interval: number }
  | { kind: 'goldPerKill'; value: number }
  | { kind: 'healOnKill'; value: number; chance?: number }
  | { kind: 'healOnKillPerGold'; value: number; max: number }
  | { kind: 'bonusDamageChance'; value: number; chance: number }
  | { kind: 'percentDamageChance'; value: number; chance: number }
  | { kind: 'lifesteal'; value: number; chance?: number }
  | { kind: 'damageOnLucasLevel'; value: number }
  | { kind: 'damageOnFactorialLevel'; value: number }
  | { kind: 'doubleStrikeChance'; value: number }
  | { kind: 'comboDamage'; value: number; max: number }
  | { kind: 'critPerCaseFound'; value: number }
  | { kind: 'critPerGold'; value: number }
  | { kind: 'critPerEmptySlot'; value: number }
  | { kind: 'damagePerEmptySlot'; value: number }
  | { kind: 'damageIfSmallDeck'; value: number; maxCards: number }
  | { kind: 'damageBelowHalfHealth'; value: number }
  | { kind: 'bossDamage'; value: number }
  | { kind: 'reflect'; value: number }
  | { kind: 'execute'; threshold: number }
  | { kind: 'revive'; healthPercent: number; bonusMaxHealthPercent?: number }
  | { kind: 'dodge'; value: number }
  | { kind: 'critAfterDodge'; value: number };

export type CardEffectKind = CardEffect['kind'];

const signed = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
const chanceSuffix = (chance?: number) => (chance && chance < 100 ? ` (${chance}% de chance)` : '');

export function describeEffect(effect: CardEffect): string {
  switch (effect.kind) {
    case 'flatDamage':
      return `${signed(effect.value)} dégâts`;
    case 'percentDamage':
      return `${signed(effect.value)}% dégâts`;
    case 'flatHealth':
      return `${signed(effect.value)} PV max`;
    case 'percentHealth':
      return `${signed(effect.value)}% PV max`;
    case 'flatCritChance':
      return `${signed(effect.value)}% chance critique`;
    case 'flatCritDamage':
      return `${signed(effect.value)}% dégâts critiques`;
    case 'damageReduction':
      return `Réduit de ${effect.value}% les dégâts reçus`;
    case 'damagePerLevels':
      return effect.interval === 1
        ? `+${effect.value} dégâts par niveau`
        : `+${effect.value} dégâts tous les ${effect.interval} niveaux`;
    case 'baseDamageMultiplierPerLevels':
      return `Dégâts de base ×${effect.multiplier} tous les ${effect.interval} niveaux`;
    case 'goldPerKill':
      return `+${effect.value} or par victoire`;
    case 'healOnKill':
      return `Soigne ${effect.value}% PV max par victoire${chanceSuffix(effect.chance)}`;
    case 'healOnKillPerGold':
      return `Soigne ${effect.value}% PV max par pièce d'or à chaque victoire (max ${effect.max}%)`;
    case 'bonusDamageChance':
      return `+${effect.value} dégâts${chanceSuffix(effect.chance)}`;
    case 'percentDamageChance':
      return `+${effect.value}% dégâts${chanceSuffix(effect.chance)}`;
    case 'lifesteal':
      return `Vol de vie ${effect.value}%${chanceSuffix(effect.chance)}`;
    case 'damageOnLucasLevel':
      return `+${effect.value}% dégâts aux niveaux de la suite de Lucas`;
    case 'damageOnFactorialLevel':
      return `+${effect.value}% dégâts aux niveaux factoriels`;
    case 'doubleStrikeChance':
      return `${effect.value}% de chance de frapper deux fois`;
    case 'comboDamage':
      return `+${effect.value}% dégâts par coup enchaîné (max ${effect.max}%)`;
    case 'critPerCaseFound':
      return `+${effect.value}% critique par caisse trouvée pendant la partie`;
    case 'critPerGold':
      return `+${effect.value}% critique par pièce d'or`;
    case 'critPerEmptySlot':
      return `+${effect.value}% critique par emplacement de deck vide`;
    case 'damagePerEmptySlot':
      return `+${effect.value}% dégâts par emplacement de deck vide`;
    case 'damageIfSmallDeck':
      return `+${effect.value}% dégâts si le deck a ${effect.maxCards} cartes ou moins`;
    case 'damageBelowHalfHealth':
      return `+${effect.value}% dégâts sous 50% PV`;
    case 'bossDamage':
      return `${signed(effect.value)}% dégâts contre les boss`;
    case 'reflect':
      return `Renvoie ${effect.value}% des dégâts reçus`;
    case 'execute':
      return `Achève l'ennemi sous ${effect.threshold}% PV`;
    case 'revive':
      return effect.bonusMaxHealthPercent
        ? `Ressuscite une fois avec ${effect.healthPercent}% PV et +${effect.bonusMaxHealthPercent}% PV max permanents`
        : `Ressuscite une fois avec ${effect.healthPercent}% PV`;
    case 'dodge':
      return `${effect.value}% de chance d'esquiver`;
    case 'critAfterDodge':
      return `+${effect.value}% critique sur le coup suivant une esquive`;
  }
}
