/**
 * Local test account with the whole collection unlocked and cases of every type.
 *
 *   npm run seed:collector -w @autobattle/server
 *
 * Idempotent: re-running resets the code and tops the cases back up.
 * Override with SEED_USERNAME / SEED_PASSWORD / SEED_CASES_PER_TYPE.
 * Dev/test data only — do not run against a production database.
 */
import { CARDS, CASE_IDS } from '@autobattle/shared';
import { hashPassword } from '../src/auth/password.js';
import { loadConfig } from '../src/config.js';
import { openDatabase, transaction } from '../src/db/index.js';

const USERNAME = process.env.SEED_USERNAME ?? 'collectionneur';
const PASSWORD = process.env.SEED_PASSWORD ?? 'collection-locale';
const CASES_PER_TYPE = Number(process.env.SEED_CASES_PER_TYPE ?? 10);

const config = loadConfig();
if (config.isProd) {
  console.error('Refusing to seed a production database (NODE_ENV=production).');
  process.exit(1);
}

const db = openDatabase(config.DATABASE_PATH);
const hash = await hashPassword(PASSWORD);
const now = Date.now();

const userId = transaction(db, () => {
  db.prepare(
    `INSERT INTO users (username, password_hash, has_pin, avatar, created_at, last_login_at) VALUES (?, ?, 0, 'default', ?, ?)
     ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, has_pin = 0, failed_logins = 0, locked_until = NULL`,
  ).run(USERNAME, hash, now, now);
  const { id } = db.prepare('SELECT id FROM users WHERE username = ?').get(USERNAME) as { id: number };

  const addCard = db.prepare(
    `INSERT INTO user_cards (user_id, card_id, count, first_obtained_at) VALUES (?, ?, 1, ?)
     ON CONFLICT (user_id, card_id) DO NOTHING`,
  );
  for (const card of CARDS) addCard.run(id, card.id, now);

  const countUnopened = db.prepare('SELECT COUNT(*) AS n FROM user_cases WHERE user_id = ? AND case_id = ? AND opened_at IS NULL');
  const addCase = db.prepare('INSERT INTO user_cases (user_id, case_id, obtained_at) VALUES (?, ?, ?)');
  for (const caseId of CASE_IDS) {
    const { n } = countUnopened.get(id, caseId) as { n: number };
    for (let i = n; i < CASES_PER_TYPE; i++) addCase.run(id, caseId, now);
  }
  return id;
});

db.close();
console.warn(`${USERNAME} (#${userId}): ${CARDS.length} cartes, ${CASES_PER_TYPE} caisses × ${CASE_IDS.length} types.`);
