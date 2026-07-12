import { randomBytes } from 'node:crypto';
import { CASE_BY_ID, isCaseId, rollCase, type CaseId, type CaseOpening, type InventoryResponse } from '@autobattle/shared';
import { transaction, type Db } from '../db/index.js';

/** Uniform float in [0, 1) from the OS CSPRNG — case results must not be predictable. */
const secureRandom = () => randomBytes(4).readUInt32BE(0) / 2 ** 32;

export class InventoryError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'NOT_ENOUGH_CASES',
    message: string,
  ) {
    super(message);
  }
}

export class InventoryService {
  constructor(private readonly db: Db) {}

  get(userId: number): InventoryResponse {
    const cards = this.db
      .prepare(
        `SELECT uc.card_id AS cardId, uc.count,
                COALESCE((SELECT MAX(opened_at) FROM user_cases c WHERE c.user_id = uc.user_id AND c.card_id = uc.card_id),
                         uc.first_obtained_at) AS lastObtainedAt
         FROM user_cards uc WHERE uc.user_id = ? ORDER BY lastObtainedAt DESC`,
      )
      .all(userId) as unknown as InventoryResponse['cards'];
    const cases = this.db
      .prepare(
        'SELECT id, case_id AS caseId, obtained_at AS obtainedAt FROM user_cases WHERE user_id = ? AND opened_at IS NULL ORDER BY id',
      )
      .all(userId) as unknown as InventoryResponse['cases'];
    return { cards, cases };
  }

  ownedCardIds(userId: number): string[] {
    return (this.db.prepare('SELECT card_id FROM user_cards WHERE user_id = ?').all(userId) as { card_id: string }[]).map(
      (r) => r.card_id,
    );
  }

  /** Only called by the server (run rewards). There is no client endpoint that creates cases. */
  grantCase(userId: number, caseId: CaseId, now = Date.now()) {
    this.db.prepare('INSERT INTO user_cases (user_id, case_id, obtained_at) VALUES (?, ?, ?)').run(userId, caseId, now);
  }

  open(userId: number, caseRowId: number, now = Date.now()): CaseOpening {
    return transaction(this.db, () => this.openOne(userId, caseRowId, now));
  }

  /** Opens `count` unopened cases of one type (the x1/x3/x5/x10 buttons). All or nothing. */
  openMany(userId: number, caseId: string, count: number, now = Date.now()): CaseOpening[] {
    return transaction(this.db, () => {
      const ids = this.db
        .prepare('SELECT id FROM user_cases WHERE user_id = ? AND case_id = ? AND opened_at IS NULL ORDER BY id LIMIT ?')
        .all(userId, caseId, count) as { id: number }[];
      if (ids.length < count) throw new InventoryError('NOT_ENOUGH_CASES', "Vous n'avez pas assez de caisses !");
      return ids.map(({ id }) => this.openOne(userId, id, now));
    });
  }

  openAll(userId: number, max = 50, now = Date.now()): CaseOpening[] {
    return transaction(this.db, () => {
      const ids = this.db
        .prepare('SELECT id FROM user_cases WHERE user_id = ? AND opened_at IS NULL ORDER BY id LIMIT ?')
        .all(userId, max) as { id: number }[];
      return ids.map(({ id }) => this.openOne(userId, id, now));
    });
  }

  private openOne(userId: number, caseRowId: number, now: number): CaseOpening {
    const row = this.db
      .prepare('SELECT id, case_id FROM user_cases WHERE id = ? AND user_id = ? AND opened_at IS NULL')
      .get(caseRowId, userId) as { id: number; case_id: string } | undefined;
    if (!row || !isCaseId(row.case_id)) throw new InventoryError('NOT_FOUND', 'Caisse introuvable');

    const card = rollCase(CASE_BY_ID.get(row.case_id)!, secureRandom);
    this.db.prepare('UPDATE user_cases SET opened_at = ?, card_id = ? WHERE id = ?').run(now, card.id, row.id);
    const existing = this.db
      .prepare('SELECT count FROM user_cards WHERE user_id = ? AND card_id = ?')
      .get(userId, card.id) as { count: number } | undefined;
    this.db
      .prepare(
        `INSERT INTO user_cards (user_id, card_id, count, first_obtained_at) VALUES (?, ?, 1, ?)
         ON CONFLICT (user_id, card_id) DO UPDATE SET count = count + 1`,
      )
      .run(userId, card.id, now);
    return { caseRowId: row.id, caseId: row.case_id, cardId: card.id, isNew: !existing };
  }

  countOpenedSince(since: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM user_cases WHERE opened_at >= ?').get(since) as { n: number }).n;
  }
}
