/* eslint-disable no-console -- CLI tool */
/**
 * Real games played on this server:  npm run balance:history [-- path/to/db]
 * Where runs end, per mode, compared with what the simulation predicts.
 */
import { DatabaseSync } from 'node:sqlite';
import { BOSSES, type BossId } from '../../src/index.js';

const db = new DatabaseSync(process.argv[2] ?? 'apps/server/data/autobattle.db', { readOnly: true });
const rows = db
  .prepare('SELECT h.*, u.username FROM run_history h JOIN users u ON u.id = h.user_id ORDER BY ended_at')
  .all() as { username: string; mode: string; level: number; won: number; end_reason: string; summary: string | null; started_at: number; ended_at: number }[];

console.log(`${rows.length} partie(s) terminée(s)`);
for (const mode of ['deck', 'classic']) {
  const r = rows.filter((x) => x.mode === mode);
  if (!r.length) continue;
  const levels = r.map((x) => x.level).sort((a, b) => a - b);
  const deaths = r.filter((x) => x.end_reason === 'death');
  console.log(`\n${mode.toUpperCase()} — ${r.length} parties, ${r.filter((x) => x.won).length} victoire(s), niveau médian ${levels[levels.length >> 1]}, max ${levels.at(-1)}`);
  const byAct = new Map<number, number>();
  for (const d of deaths) byAct.set(Math.floor(d.level / 10) + 1, (byAct.get(Math.floor(d.level / 10) + 1) ?? 0) + 1);
  console.log('  morts par acte:', [...byAct].sort((a, b) => a[0] - b[0]).map(([a, n]) => `acte ${a}: ${n}`).join(', ') || '-');
  const bosses = new Map<string, number>();
  for (const d of deaths) {
    const facing = d.summary ? (JSON.parse(d.summary) as { facing: BossId | null }).facing : null;
    if (facing && d.level % 10 === 9) bosses.set(BOSSES[facing].name, (bosses.get(BOSSES[facing].name) ?? 0) + 1);
  }
  if (bosses.size) console.log('  boss fatals:', [...bosses].map(([b, n]) => `${b} ×${n}`).join(', '));
}
console.log('\nDernières parties:');
for (const r of rows.slice(-8)) {
  console.log(`  ${r.username.padEnd(16)} ${r.mode.padEnd(8)} niv. ${String(r.level + 1).padStart(3)} ${r.won ? 'VICTOIRE' : r.end_reason.padEnd(8)} ${((r.ended_at - r.started_at) / 60000).toFixed(1)} min`);
}
