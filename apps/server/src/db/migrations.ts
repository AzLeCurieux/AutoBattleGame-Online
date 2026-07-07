export const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    has_pin       INTEGER NOT NULL DEFAULT 0,
    avatar        TEXT    NOT NULL DEFAULT 'default',
    role          TEXT    NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
    best_level    INTEGER NOT NULL DEFAULT 0,
    best_level_at INTEGER,
    created_at    INTEGER NOT NULL,
    last_login_at INTEGER,
    -- Brute-force protection (PINs only have 10 000 combinations).
    failed_logins INTEGER NOT NULL DEFAULT 0,
    lock_count    INTEGER NOT NULL DEFAULT 0,
    locked_until  INTEGER
  );
  CREATE INDEX idx_users_best ON users (best_level DESC, best_level_at ASC);

  CREATE TABLE sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX idx_sessions_user ON sessions (user_id);
  CREATE INDEX idx_sessions_expiry ON sessions (expires_at);

  CREATE TABLE runs (
    user_id    INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    state      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE run_history (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    level      INTEGER NOT NULL,
    kills      INTEGER NOT NULL,
    gold_earned INTEGER NOT NULL DEFAULT 0,
    deck       TEXT    NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER NOT NULL,
    end_reason TEXT    NOT NULL CHECK (end_reason IN ('death', 'abandon'))
  );
  CREATE INDEX idx_history_user ON run_history (user_id, ended_at DESC);

  CREATE TABLE user_cases (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    case_id     TEXT    NOT NULL,
    obtained_at INTEGER NOT NULL,
    opened_at   INTEGER,
    card_id     TEXT
  );
  CREATE INDEX idx_cases_unopened ON user_cases (user_id) WHERE opened_at IS NULL;

  CREATE TABLE user_cards (
    user_id           INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    card_id           TEXT    NOT NULL,
    count             INTEGER NOT NULL,
    first_obtained_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, card_id)
  ) WITHOUT ROWID;
  `,
  /* 2 — classic mode (no cards): separate personal best and leaderboard */ `
  ALTER TABLE users ADD COLUMN best_level_classic INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN best_level_classic_at INTEGER;
  CREATE INDEX idx_users_best_classic ON users (best_level_classic DESC, best_level_classic_at ASC);
  ALTER TABLE run_history ADD COLUMN mode TEXT NOT NULL DEFAULT 'deck';
  `,
  /* 3 — wins (act 8 beaten) and a per-run summary for balance analysis */ `
  ALTER TABLE run_history ADD COLUMN won INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE run_history ADD COLUMN summary TEXT;
  `,
  /* 4 — difficulty tiers: highest unlocked tier per player, tier of each archived run */ `
  ALTER TABLE users ADD COLUMN palier_unlocked INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE run_history ADD COLUMN palier INTEGER NOT NULL DEFAULT 1;
  UPDATE users SET palier_unlocked = 2
   WHERE id IN (SELECT user_id FROM run_history WHERE won = 1)
      OR id IN (SELECT user_id FROM runs WHERE json_extract(state, '$.won') = 1);
  `,
];
