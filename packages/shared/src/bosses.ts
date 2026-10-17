/**
 * Act bosses (deck mode, every 10th stage). Each one bends a rule of the fight
 * and weakens some builds, but none is an automatic loss: it is announced at the
 * start of the act and can be swapped in the shop for gold.
 */
export const BOSS_IDS = ['colossus', 'thief', 'swift', 'berserk', 'armored', 'stoic', 'silencer', 'vampire', 'thorns'] as const;
export type BossId = (typeof BOSS_IDS)[number];

export interface BossInfo {
  id: BossId;
  name: string;
  text: string;
  /** First act this boss can appear in (the harshest ones come later). */
  minAct: number;
}

export const BOSSES: Record<BossId, BossInfo> = {
  colossus: { id: 'colossus', name: 'Le Colosse', text: '+30 % de PV.', minAct: 1 },
  thief: { id: 'thief', name: 'Le Pillard', text: 'Te vole 1 or à chaque coup qu’il porte.', minAct: 1 },
  swift: { id: 'swift', name: 'L’Éclair', text: 'Frappe toujours en premier.', minAct: 1 },
  berserk: { id: 'berserk', name: 'L’Enragé', text: 'Ses dégâts augmentent de 8 % à chaque tour.', minAct: 1 },
  armored: { id: 'armored', name: 'Le Blindé', text: 'Tes coups non critiques font 35 % de dégâts en moins.', minAct: 2 },
  stoic: { id: 'stoic', name: 'L’Imperturbable', text: 'Tes coups critiques sont deux fois moins puissants.', minAct: 2 },
  silencer: { id: 'silencer', name: 'Le Muet', text: 'Désactive la première carte de ton deck pendant le combat.', minAct: 2 },
  vampire: { id: 'vampire', name: 'Le Vampire', text: 'Récupère 3 % de ses PV à chaque coup qu’il porte.', minAct: 3 },
  thorns: { id: 'thorns', name: 'L’Épineux', text: 'Chacun de tes coups te coûte 2 % de tes PV max.', minAct: 3 },
};

export function bossPool(act: number, exclude: BossId | null): BossId[] {
  const pool = BOSS_IDS.filter((id) => BOSSES[id].minAct <= act && id !== exclude);
  return pool.length ? pool : [...BOSS_IDS];
}
