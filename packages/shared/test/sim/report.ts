/* eslint-disable no-console -- CLI tool */
/**
 * Balance report:  npm run balance
 * Survival per act for every player profile, fight feel per act, card ranking.
 */
import { CARDS, createEnemy, createRun, RARITY_INFO, RULES } from '../../src/index.js';
import { advance, ALL_CARDS, newRuns, seedOf, STARTER_CARDS, type SimOptions, type Trace } from './bot.js';

const N = Number(process.env.N ?? 600);
const pct = (x: number) => `${(x * 100).toFixed(0).padStart(3)} %`;
const acts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

function profile(label: string, opts: SimOptions) {
  const trace: Trace = { fights: [] };
  const finals = newRuns(N, opts.mode).map((s) => advance(s, opts, trace));
  const levels = finals.map((s) => s.level).sort((a, b) => a - b);
  const reach = acts.map((a) => finals.filter((s) => s.level >= a * 10).length / N);
  console.log(`${label.padEnd(34)} médiane niv. ${String(levels[N >> 1]).padStart(3)} | acte terminé: ${acts.map((a, i) => `${a}:${pct(reach[i]!)}`).join(' ')}`);
  return trace;
}

console.log(`COURBE ENNEMIE (mode Deck) — PV / dégâts`);
for (let act = 1; act <= 10; act++) {
  const row = [0, 4, 9].map((p) => {
    const e = createEnemy((act - 1) * 10 + p, 'deck', null);
    return `${e.kind.padEnd(6)} ${String(e.maxHp).padStart(9)} / ${String(e.damage).padStart(5)}`;
  });
  console.log(`  acte ${String(act).padStart(2)}${act > RULES.acts.winAct ? ' (infini)' : '         '} ${row.join('   ')}`);
}

console.log(`\nSURVIE PAR PROFIL (${N} parties chacun)`);
profile('Deck · débutant, sans collection', { skill: 'novice', mode: 'deck', owned: STARTER_CARDS });
profile('Deck · moyen, sans collection', { skill: 'average', mode: 'deck', owned: STARTER_CARDS });
const ref = profile('Deck · moyen, collection complète', { skill: 'average', mode: 'deck', owned: ALL_CARDS });
profile('Deck · expert, collection complète', { skill: 'expert', mode: 'deck', owned: ALL_CARDS });
profile('Classique · moyen', { skill: 'average', mode: 'classic', owned: [] });

console.log(`\nSENSATION DE COMBAT (joueur moyen) — coups pour tuer / PV perdus par combat`);
for (let act = 1; act <= 9; act++) {
  const cell = (kind: string) => {
    const f = ref.fights.filter((x) => Math.ceil(x.stage / 10) === act && x.kind === kind);
    if (!f.length) return '      -      ';
    const avg = (g: (x: (typeof f)[number]) => number) => f.reduce((a, x) => a + g(x), 0) / f.length;
    return `${avg((x) => x.hits).toFixed(1).padStart(5)} / ${pct(avg((x) => x.hpLost))}`;
  };
  console.log(`  acte ${act}: normal ${cell('normal')}   élite ${cell('elite')}   boss ${cell('boss')}`);
}

if (!process.env.SKIP_CARDS) {
  const M = Math.min(N, 300);
  const mean = (card?: string) => {
    let total = 0;
    for (let i = 0; i < M; i++) {
      let s = createRun(seedOf(i), 0, 'deck');
      if (card) s = { ...s, deck: [{ cardId: card, modifier: null, price: 0 }] };
      total += advance(s, { skill: 'average', mode: 'deck', owned: STARTER_CARDS }).level;
    }
    return total / M;
  };
  const base = mean();
  console.log(`\nAPPORT DE CHAQUE CARTE (possédée dès le départ, niveaux gagnés en moyenne ; référence ${base.toFixed(1)})`);
  const rows = CARDS.map((c) => ({ c, d: mean(c.id) - base })).sort((a, b) => b.d - a.d);
  for (const { c, d } of rows) console.log(`  ${(d >= 0 ? '+' : '') + d.toFixed(1)}\t${c.rarity.padEnd(11)} ${String(RARITY_INFO[c.rarity].shopPrice).padStart(2)} or  ${c.name}`);
}
