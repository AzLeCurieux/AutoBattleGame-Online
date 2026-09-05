import type { CombatEvent, KillReward, Proc } from '@autobattle/shared';

const n = (v?: number) => (v ?? 0).toLocaleString('fr-FR');

/** Short text shown on a card when it triggers ("+60 %", "+45 PV"…). */
export function procLabel(p: Proc): string {
  switch (p.kind) {
    case 'bonusDamageChance':
      return `+${n(p.amount)} dégâts`;
    case 'percentDamageChance':
    case 'damageBelowHalfHealth':
    case 'bossDamage':
    case 'damageOnLucasLevel':
    case 'damageOnFactorialLevel':
    case 'comboDamage':
      return `+${n(p.amount)} %`;
    case 'critAfterDodge':
      return `+${n(p.amount)} % crit`;
    case 'doubleStrikeChance':
      return 'Double frappe';
    case 'execute':
      return 'Exécution';
    case 'lifesteal':
      return `+${n(p.amount)} PV`;
    case 'reflect':
      return `${n(p.amount)} renvoyés`;
    case 'dodge':
      return 'Esquive';
    case 'revive':
      return 'Résurrection';
    case 'goldPerKill':
      return `+${n(p.amount)} or`;
    case 'healOnKill':
    case 'healOnKillPerGold':
      return `+${n(p.amount)} % PV`;
    default:
      return 'Activée';
  }
}

/** Per-slot trigger count of a whole fight (for the history summary). */
export function countProcs(events: readonly CombatEvent[], reward?: KillReward | null): Map<number, number> {
  const counts = new Map<number, number>();
  const add = (list?: Proc[]) => {
    for (const p of list ?? []) if (p.card >= 0) counts.set(p.card, (counts.get(p.card) ?? 0) + 1);
  };
  for (const e of events) add(e.procs);
  add(reward?.procs);
  return counts;
}
