import { RULES, isFactorialNumber, isLucasNumber, palierRules, stageKind } from '../rules.js';
import { eliteBoss } from './shop.js';
import type { Rng } from './rng.js';
import { computeStats, createEnemy, deckEffects, ofKind, silencedIndex, srcOf, sumEffect } from './stats.js';
import type { CombatEvent, EnemyInfo, Proc, RunState } from './types.js';

export interface CombatOutcome {
  enemy: EnemyInfo;
  startHp: number;
  restHp: number;
  events: CombatEvent[];
  outcome: 'victory' | 'defeat';
  damageDealt: number;
}

/**
 * Resolve a whole fight on the server, turn by turn. Mutates `run.hp`,
 * `run.base.maxHp` (revive bonus) and `run.reviveUsed`. The returned event
 * log is everything the client needs to animate the fight.
 */
export function simulateFight(run: RunState, rng: Rng): CombatOutcome {
  const mode = run.mode ?? 'deck';
  const tier = palierRules(mode === 'deck' ? run.palier : 1);
  const effect = mode !== 'deck' ? null : stageKind(run.level + 1, mode) === 'elite' ? eliteBoss(run) : (run.nextBoss ?? null);
  const enemy = createEnemy(run.level, mode, effect, mode === 'deck' ? run.palier : 1);
  const stage = enemy.stage;
  const boss = enemy.bossId;
  const silenced = boss === 'silencer' ? silencedIndex(run.deck) : -1;
  let clutchUsed = false;
  const fx = deckEffects(run.deck, silenced);
  const events: CombatEvent[] = [];
  // Rest before the boss: the climax tests the build, not the HP left after the act.
  let restHp = 0;
  if (enemy.kind === 'boss' && mode === 'deck') {
    const max = computeStats(run, stage).maxHp;
    const healed = Math.min(max, run.hp + Math.floor((max * tier.bossRestPercent) / 100));
    restHp = healed - run.hp;
    run.hp = healed;
  }
  const startHp = run.hp;

  let stats = computeStats(run, stage, silenced);
  let turn = 0;
  let enemyHp = enemy.maxHp;
  let combo = 0;
  let dodgedLastAttack = false;
  let damageDealt = 0;

  const executes = ofKind(fx, 'execute');
  const executeThreshold = Math.max(0, ...executes.map((e) => e.threshold));
  const revive = ofKind(fx, 'revive').sort((a, b) => b.healthPercent - a.healthPercent)[0];
  const doubleStrike = sumEffect(fx, 'doubleStrikeChance');
  const doubleStrikers = ofKind(fx, 'doubleStrikeChance');
  const reflectors = ofKind(fx, 'reflect');
  const dodgers = ofKind(fx, 'dodge');
  const proc = (e: Parameters<typeof srcOf>[0], amount?: number): Proc => ({ card: srcOf(e), kind: e.kind, ...(amount !== undefined ? { amount } : {}) });
  const combos = ofKind(fx, 'comboDamage');
  const reflect = sumEffect(fx, 'reflect');
  const critAfterDodge = sumEffect(fx, 'critAfterDodge');

  const snapshot = () => ({ playerHp: run.hp, enemyHp: Math.max(0, enemyHp) });

  const playerStrike = (extra: boolean) => {
    const procs: Proc[] = extra ? doubleStrikers.map((e) => proc(e)) : [];
    if (executeThreshold > 0 && (enemyHp / enemy.maxHp) * 100 <= executeThreshold) {
      const dmg = enemyHp;
      enemyHp = 0;
      damageDealt += dmg;
      events.push({ type: 'execute', damage: dmg, ...snapshot(), procs: [...procs, ...executes.map((e) => proc(e, dmg))] });
      return;
    }

    let dmg = stats.attack;
    for (const e of ofKind(fx, 'bonusDamageChance')) {
      if (rng.chance(e.chance)) {
        dmg += e.value;
        procs.push(proc(e, e.value));
      }
    }

    // Every conditional bonus that applies is recorded, so the player sees which card did what.
    let multiplier = 1 + sumEffect(fx, 'percentDamage') / 100;
    for (const e of ofKind(fx, 'percentDamageChance')) {
      if (rng.chance(e.chance)) {
        multiplier *= 1 + e.value / 100;
        procs.push(proc(e, e.value));
      }
    }
    multiplier *= 1 + (sumEffect(fx, 'damagePerEmptySlot') * stats.emptySlots) / 100;
    for (const e of ofKind(fx, 'damageIfSmallDeck')) if (run.deck.length <= e.maxCards) multiplier *= 1 + e.value / 100;
    // Summed (not compounded) like before; only the log gets one entry per card.
    const belowHalf = run.hp < stats.maxHp / 2;
    if (belowHalf) {
      multiplier *= 1 + sumEffect(fx, 'damageBelowHalfHealth') / 100;
      for (const e of ofKind(fx, 'damageBelowHalfHealth')) procs.push(proc(e, e.value));
    }
    if (enemy.isBoss) {
      multiplier *= 1 + sumEffect(fx, 'bossDamage') / 100;
      for (const e of ofKind(fx, 'bossDamage')) procs.push(proc(e, e.value));
    }
    if (isLucasNumber(stage)) {
      multiplier *= 1 + sumEffect(fx, 'damageOnLucasLevel') / 100;
      for (const e of ofKind(fx, 'damageOnLucasLevel')) procs.push(proc(e, e.value));
    }
    if (isFactorialNumber(stage)) {
      multiplier *= 1 + sumEffect(fx, 'damageOnFactorialLevel') / 100;
      for (const e of ofKind(fx, 'damageOnFactorialLevel')) procs.push(proc(e, e.value));
    }
    for (const e of combos) {
      const bonus = Math.min(e.value * combo, e.max);
      multiplier *= 1 + bonus / 100;
      if (bonus > 0) procs.push(proc(e, bonus));
    }
    dmg = Math.max(0, dmg * multiplier);

    const critBoost = dodgedLastAttack && critAfterDodge > 0;
    if (critBoost) for (const e of ofKind(fx, 'critAfterDodge')) procs.push(proc(e, e.value));
    const critChance = Math.min(100, stats.critChance + (dodgedLastAttack ? critAfterDodge : 0));
    dodgedLastAttack = false;
    const crit = rng.chance(critChance);
    if (crit) dmg *= 1 + (stats.critDamage / 100) * (boss === 'stoic' ? 0.5 : 1);
    else if (boss === 'armored') dmg *= 0.65;
    dmg = Math.floor(dmg);

    enemyHp -= dmg;
    damageDealt += dmg;
    combo++;
    events.push({ type: 'hit', by: 'player', damage: dmg, crit, ...snapshot(), ...(procs.length ? { procs } : {}), ...(extra ? { extra } : {}) });

    if (boss === 'thorns' && run.hp > 1) {
      // Never lethal on its own: it wears the player down for the boss's hits.
      const cost = Math.min(run.hp - 1, Math.floor(stats.maxHp * 0.02));
      run.hp -= cost;
      events.push({ type: 'boss', effect: 'thorns', amount: cost, ...snapshot() });
    }

    for (const e of ofKind(fx, 'lifesteal')) {
      if (e.chance !== undefined && !rng.chance(e.chance)) continue;
      const heal = Math.min(Math.floor((dmg * e.value) / 100), stats.maxHp - run.hp);
      if (heal > 0) {
        run.hp += heal;
        events.push({ type: 'lifesteal', amount: heal, ...snapshot(), procs: [proc(e, heal)] });
      }
    }
  };

  const enemyStrike = () => {
    if (rng.chance(stats.dodge)) {
      dodgedLastAttack = true;
      events.push({ type: 'dodge', ...snapshot(), procs: dodgers.map((e) => proc(e)) });
      return;
    }
    const rage = boss === 'berserk' ? 1 + 0.08 * turn : 1;
    const raw = Math.floor(enemy.damage * rage * (1 - stats.damageReduction / 100));
    // No one-shots: a single hit never takes more than maxHitPercent of max HP.
    const dmg = Math.min(raw, Math.max(1, Math.floor((stats.maxHp * RULES.acts.maxHitPercent) / 100)));
    run.hp = Math.max(0, run.hp - dmg);
    events.push({ type: 'hit', by: 'enemy', damage: dmg, crit: false, ...snapshot() });

    if (run.hp <= 0 && enemy.kind === 'boss' && mode === 'deck' && tier.clutch && !clutchUsed && enemyHp > 0 && (enemyHp / enemy.maxHp) * 100 <= RULES.acts.clutchBossHpPercent) {
      clutchUsed = true;
      run.hp = 1;
      events.push({ type: 'clutch', ...snapshot() });
    }

    if (boss === 'vampire' && enemyHp > 0) {
      const heal = Math.min(enemy.maxHp - enemyHp, Math.floor(enemy.maxHp * 0.03));
      if (heal > 0) {
        enemyHp += heal;
        events.push({ type: 'boss', effect: 'vampire', amount: heal, ...snapshot() });
      }
    }
    if (boss === 'thief' && run.gold > 0) {
      run.gold -= 1;
      stats = computeStats(run, stage, silenced);
      events.push({ type: 'boss', effect: 'thief', amount: 1, ...snapshot() });
    }

    if (reflect > 0) {
      const back = Math.floor((enemy.damage * reflect) / 100);
      if (back > 0) {
        enemyHp -= back;
        damageDealt += back;
        events.push({ type: 'reflect', damage: back, ...snapshot(), procs: reflectors.map((e) => proc(e, Math.floor((enemy.damage * e.value) / 100))) });
      }
    }

    if (run.hp <= 0 && revive && !run.reviveUsed) {
      run.reviveUsed = true;
      if (revive.bonusMaxHealthPercent) {
        run.base.maxHp += Math.floor((run.base.maxHp * revive.bonusMaxHealthPercent) / 100);
        stats = computeStats(run, stage, silenced);
      }
      run.hp = Math.max(1, Math.floor((stats.maxHp * revive.healthPercent) / 100));
      events.push({ type: 'revive', ...snapshot(), procs: [proc(revive)] });
    }
  };

  if (boss === 'swift') enemyStrike();
  for (turn = 0; turn < RULES.maxTurnsPerFight && run.hp > 0; turn++) {
    const strikes = rng.chance(doubleStrike) ? 2 : 1;
    for (let i = 0; i < strikes && enemyHp > 0; i++) playerStrike(i > 0);
    if (enemyHp <= 0) break;
    enemyStrike();
    if (enemyHp <= 0 || run.hp <= 0) break;
  }

  // A fight that hits the turn cap counts as a defeat (prevents infinite stalls).
  const outcome = enemyHp <= 0 && run.hp > 0 ? 'victory' : 'defeat';
  if (outcome === 'defeat') run.hp = 0;
  return { enemy, startHp, restHp, events, outcome, damageDealt };
}
