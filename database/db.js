const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

class Database {
  constructor() {
    this.db = null;
  }

  async ensureUserColumn(columnName, type) {
    try {
      const row = await this.get(`PRAGMA table_info(users)`);
      // sqlite3 driver returns one row at a time for get; use all then check list
    } catch (_) { }
    try {
      const cols = await this.all(`PRAGMA table_info(users)`);
      const exists = cols.some(c => c.name === columnName);
      if (!exists) {
        await this.run(`ALTER TABLE users ADD COLUMN ${columnName} ${type}`);
      }
    } catch (e) {
      // swallow if cannot alter in some environments
      console.warn('ensureUserColumn warn:', e?.message || e);
    }
  }

  async ensureTableColumn(tableName, columnName, type) {
    try {
      const cols = await this.all(`PRAGMA table_info(${tableName})`);
      const exists = cols.some(c => c.name === columnName);
      if (!exists) {
        await this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${type}`);
      }
    } catch (e) {
      // swallow if cannot alter in some environments
      console.warn(`ensureTableColumn warn (${tableName}.${columnName}):`, e?.message || e);
    }
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      // Prefer a writable, persistent path in Azure App Service (/home is writable)
      const defaultDir = process.env.SQLITE_DB_DIR
        || (process.env.HOME ? path.join(process.env.HOME, 'data') : '/home/data');
      const dbPath = process.env.SQLITE_DB_PATH || path.join(defaultDir, 'game.db');

      // Ensure directory exists
      try {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      } catch (mkErr) {
        console.error('Failed to ensure DB directory exists:', mkErr);
      }

      this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Error opening database:', err, '\nPath:', dbPath);
          reject(err);
        } else {
          console.log('Connected to SQLite database at', dbPath);
          // Improve reliability under load
          this.db.run('PRAGMA journal_mode = WAL');
          this.db.run('PRAGMA busy_timeout = 3000');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        avatar TEXT DEFAULT 'default',
        display_name TEXT,
        last_display_name_change DATETIME,
        last_username_change DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_online BOOLEAN DEFAULT 0
      )`,

      // Game sessions table
      `CREATE TABLE IF NOT EXISTS game_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT UNIQUE NOT NULL,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        level_reached INTEGER DEFAULT 0,
        gold_earned INTEGER DEFAULT 0,
        enemies_killed INTEGER DEFAULT 0,
        boss_defeated BOOLEAN DEFAULT 0,
        loot_boxes_found INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Game states table for persistent game state
      `CREATE TABLE IF NOT EXISTS game_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT DEFAULT 'default',
        session_id TEXT UNIQUE NOT NULL,
        run_id TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        ended_at INTEGER,
        end_reason TEXT,
        player_data TEXT NOT NULL,
        passive_upgrades TEXT DEFAULT '[]',
        boss_passives TEXT DEFAULT '[]',
        loot_boxes_found INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Scores table
      `CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT,
        level INTEGER NOT NULL,
        score INTEGER NOT NULL,
        gold INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_validated BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (session_id) REFERENCES game_sessions (session_id)
      )`,

      // Leaderboard table (materialized view)
      `CREATE TABLE IF NOT EXISTS leaderboard (
        user_id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        avatar TEXT DEFAULT 'default',
        best_level INTEGER DEFAULT 0,
        best_score INTEGER DEFAULT 0,
        total_gold INTEGER DEFAULT 0,
        total_loot_boxes INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        last_activity DATETIME,
        rank_position INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Anti-cheat logs
      `CREATE TABLE IF NOT EXISTS cheat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        session_id TEXT,
        action_type TEXT NOT NULL,
        suspicious_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_flagged BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Loot box inventory
      `CREATE TABLE IF NOT EXISTS loot_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        loot_box_id TEXT UNIQUE NOT NULL,
        rarity TEXT NOT NULL,
        color TEXT NOT NULL,
        emoji TEXT NOT NULL,
        level INTEGER NOT NULL,
        obtained_at INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,
      // Player loot items inventory (items lootés)
      `CREATE TABLE IF NOT EXISTS player_loot_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        rarity TEXT NOT NULL,
        item_text TEXT NOT NULL,
        item_image TEXT NOT NULL,
        item_value INTEGER NOT NULL,
        obtained_at INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }
    // Ensure new columns exist when table already created previously
    await this.ensureUserColumn('last_username_change', 'DATETIME');
    await this.ensureUserColumn('display_name', 'TEXT');
    await this.ensureUserColumn('last_display_name_change', 'DATETIME');
    await this.ensureUserColumn('has_pin', 'BOOLEAN DEFAULT 0'); // Nouveau : indique si l'utilisateur utilise un code PIN
    await this.ensureUserColumn('deck', "TEXT DEFAULT '[]'"); // Deck du joueur

    // Ensure game_sessions columns
    await this.ensureTableColumn('game_sessions', 'loot_boxes_found', 'INTEGER DEFAULT 0');

    // Ensure leaderboard columns
    await this.ensureTableColumn('leaderboard', 'total_loot_boxes', 'INTEGER DEFAULT 0');

    // Create indexes for better performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank_position)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_loot_inventory_user_id ON loot_inventory(user_id)');

    // OPTIMIZATION Phase 2: Additional indexes for player_loot_inventory
    await this.run('CREATE INDEX IF NOT EXISTS idx_player_loot_user_id ON player_loot_inventory(user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_player_loot_obtained_at ON player_loot_inventory(obtained_at DESC)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_player_loot_user_obtained ON player_loot_inventory(user_id, obtained_at DESC)');

    // OPTIMIZATION Phase 3: Timestamp tracking for delta updates
    await this.ensureTableColumn('player_loot_inventory', 'updated_at', 'INTEGER');
    await this.ensureTableColumn('player_loot_inventory', 'deleted_at', 'INTEGER DEFAULT NULL');
    await this.run('CREATE INDEX IF NOT EXISTS idx_player_loot_updated ON player_loot_inventory(user_id, updated_at DESC)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_player_loot_deleted ON player_loot_inventory(user_id, deleted_at)');

    console.log('✔️ Database indexes created/verified');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // User management methods
  async createUser(username, email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await this.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    return result.id;
  }

  async getUserByUsername(username) {
    return await this.get('SELECT * FROM users WHERE username = ?', [username]);
  }

  async getUserById(id) {
    return await this.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async updateUserLastLogin(id) {
    await this.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  async setUserOnline(id, isOnline) {
    await this.run('UPDATE users SET is_online = ? WHERE id = ?', [isOnline, id]);
  }

  // Game session methods
  async createGameSession(userId, sessionId) {
    await this.run(
      'INSERT INTO game_sessions (user_id, session_id) VALUES (?, ?)',
      [userId, sessionId]
    );
  }

  async updateGameSession(sessionId, data) {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    values.push(sessionId);

    await this.run(
      `UPDATE game_sessions SET ${fields} WHERE session_id = ?`,
      values
    );
  }

  async endGameSession(sessionId) {
    await this.run(
      'UPDATE game_sessions SET end_time = CURRENT_TIMESTAMP, is_active = 0 WHERE session_id = ?',
      [sessionId]
    );
  }

  // Score methods
  async submitScore(userId, sessionId, level, score, gold) {
    // Score recorded

    await this.run(
      'INSERT INTO scores (user_id, session_id, level, score, gold) VALUES (?, ?, ?, ?, ?)',
      [userId, sessionId, level, score, gold]
    );

    // Score saved
  }

  async getUserBestScore(userId) {
    const result = await this.get(
      'SELECT MAX(score) as best_score, MAX(level) as best_level FROM scores WHERE user_id = ?',
      [userId]
    );
    console.log(`📈 Meilleur score pour user ${userId}:`, result);
    return result;
  }

  // Leaderboard methods
  async updateLeaderboard() {
    try {
      // Updating leaderboard

      // Clear current leaderboard
      await this.run('DELETE FROM leaderboard');
      // Leaderboard cleared

      // Vérifier s'il y a des utilisateurs avec des scores
      const userCount = await this.get('SELECT COUNT(*) as count FROM users');
      const scoreCount = await this.get('SELECT COUNT(*) as count FROM scores');

      // User count

      if (userCount.count === 0) {
        console.log('⚠️ Aucun utilisateur trouvé, leaderboard vide');
        return;
      }

      // Insert updated leaderboard - Score basé sur le niveau atteint, agrégation propre
      let result;
      try {
        result = await this.run(`
          INSERT OR REPLACE INTO leaderboard (user_id, username, avatar, best_level, best_score, total_gold, total_loot_boxes, games_played, last_activity, rank_position)
          SELECT
            u.id,
            COALESCE(u.display_name, u.username) as username,
            u.avatar,
            COALESCE((SELECT MAX(level) FROM scores WHERE user_id = u.id), 0) as best_level,
            COALESCE((SELECT MAX(level) FROM scores WHERE user_id = u.id), 0) as best_score,
            COALESCE((SELECT SUM(gold) FROM scores WHERE user_id = u.id), 0) as total_gold,
            COALESCE((SELECT COUNT(*) FROM loot_inventory WHERE user_id = u.id), 0) as total_loot_boxes,
            (SELECT COUNT(DISTINCT session_id) FROM scores WHERE user_id = u.id) as games_played,
            COALESCE(MAX(u.last_login), u.created_at) as last_activity,
            ROW_NUMBER() OVER (ORDER BY (SELECT MAX(level) FROM scores WHERE user_id = u.id) DESC, (SELECT MAX(timestamp) FROM scores WHERE user_id = u.id) DESC) as rank_position
          FROM users u
          GROUP BY u.id, username, u.avatar
        `);
        // Leaderboard updated
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          console.log('⚠️ Constraint error during leaderboard update, retrying...');
          // Retry with a different approach (delete then insert)
          await this.run('DELETE FROM leaderboard');
          result = await this.run(`
            INSERT INTO leaderboard (user_id, username, avatar, best_level, best_score, total_gold, total_loot_boxes, games_played, last_activity, rank_position)
            SELECT
              u.id,
              COALESCE(u.display_name, u.username) as username,
              u.avatar,
              COALESCE((SELECT MAX(level) FROM scores WHERE user_id = u.id), 0) as best_level,
              COALESCE((SELECT MAX(level) FROM scores WHERE user_id = u.id), 0) as best_score,
              COALESCE((SELECT SUM(gold) FROM scores WHERE user_id = u.id), 0) as total_gold,
              COALESCE((SELECT COUNT(*) FROM loot_inventory WHERE user_id = u.id), 0) as total_loot_boxes,
              (SELECT COUNT(DISTINCT session_id) FROM scores WHERE user_id = u.id) as games_played,
              COALESCE(MAX(u.last_login), u.created_at) as last_activity,
              ROW_NUMBER() OVER (ORDER BY (SELECT MAX(level) FROM scores WHERE user_id = u.id) DESC, (SELECT MAX(timestamp) FROM scores WHERE user_id = u.id) DESC) as rank_position
            FROM users u
            GROUP BY u.id, username, u.avatar
          `);
          // Leaderboard updated
        } else {
          throw error;
        }
      }

      // Vérifier le contenu du leaderboard
      const leaderboard = await this.all('SELECT * FROM leaderboard ORDER BY rank_position LIMIT 5');
      // Top leaderboard
      leaderboard.forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.username} - Niveau ${player.best_level}`);
      });

      return result.changes;

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du leaderboard:', error);
      throw error;
    }
  }

  async getLeaderboard(limit = 50) {
    try {
      const leaderboard = await this.all(
        'SELECT * FROM leaderboard ORDER BY rank_position LIMIT ?',
        [limit]
      );
      // Leaderboard retrieved
      return leaderboard;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du leaderboard:', error);
      return [];
    }
  }

  // Anti-cheat methods
  async logSuspiciousActivity(userId, sessionId, actionType, data) {
    await this.run(
      'INSERT INTO cheat_logs (user_id, session_id, action_type, suspicious_data) VALUES (?, ?, ?, ?)',
      [userId, sessionId, actionType, JSON.stringify(data)]
    );
  }

  async getSuspiciousActivities(userId, limit = 10) {
    return await this.all(
      'SELECT * FROM cheat_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
      [userId, limit]
    );
  }

  // Loot inventory methods
  async saveLootBox(userId, lootBox) {
    await this.run(
      'INSERT OR REPLACE INTO loot_inventory (user_id, loot_box_id, rarity, color, emoji, level, obtained_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, lootBox.id, lootBox.rarity, lootBox.color, lootBox.emoji, lootBox.level, lootBox.obtainedAt]
    );
  }

  async saveLootBoxesBatch(userId, lootBoxes) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        const stmt = this.db.prepare('INSERT OR REPLACE INTO loot_inventory (user_id, loot_box_id, rarity, color, emoji, level, obtained_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

        try {
          for (const lootBox of lootBoxes) {
            stmt.run([userId, lootBox.id, lootBox.rarity, lootBox.color, lootBox.emoji, lootBox.level, lootBox.obtainedAt]);
          }
          stmt.finalize();

          this.db.run('COMMIT', (err) => {
            if (err) {
              console.error('Transaction commit error:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        } catch (error) {
          this.db.run('ROLLBACK');
          console.error('Error in batch save:', error);
          reject(error);
        }
      });
    });
  }

  async getUserInventory(userId) {
    const rows = await this.all(
      'SELECT loot_box_id as id, rarity, color, emoji, level, obtained_at as obtainedAt FROM loot_inventory WHERE user_id = ? ORDER BY obtained_at DESC',
      [userId]
    );
    return rows;
  }

  async clearUserInventory(userId) {
    await this.run('DELETE FROM loot_inventory WHERE user_id = ?', [userId]);
  }

  // Player loot inventory methods (items lootés)
  async saveLootItem(userId, itemId, rarity, itemData) {
    const now = Date.now();
    await this.run(
      'INSERT OR REPLACE INTO player_loot_inventory (user_id, item_id, rarity, item_text, item_image, item_value, obtained_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, itemId, rarity, itemData.text || '', itemData.image || '', itemData.value || 0, now, now]
    );
  }

  async getUserLootInventory(userId) {
    const rows = await this.all(
      'SELECT item_id as id, rarity, item_text as text, item_image as image, item_value as value, obtained_at as obtainedAt FROM player_loot_inventory WHERE user_id = ? ORDER BY obtained_at DESC',
      [userId]
    );
    return rows;
  }

  // OPTIMIZATION Phase 2: Paginated version
  async getUserLootInventoryPaginated(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Get total count for pagination metadata
    const countResult = await this.get(
      'SELECT COUNT(*) as total FROM player_loot_inventory WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );

    // Get paginated results
    const rows = await this.all(
      'SELECT item_id as id, rarity, item_text as text, item_image as image, item_value as value, obtained_at as obtainedAt FROM player_loot_inventory WHERE user_id = ? AND deleted_at IS NULL ORDER BY obtained_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
        hasMore: offset + rows.length < countResult.total
      }
    };
  }

  // OPTIMIZATION Phase 3: Delta updates
  async getUserLootInventoryDelta(userId, sinceTimestamp) {
    // Get items added or modified since timestamp
    const addedOrUpdated = await this.all(
      `SELECT item_id as id, rarity, item_text as text, item_image as image, 
              item_value as value, obtained_at as obtainedAt, updated_at as updatedAt
       FROM player_loot_inventory 
       WHERE user_id = ? AND updated_at > ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId, sinceTimestamp]
    );

    // Get items deleted since timestamp
    const removed = await this.all(
      `SELECT item_id as id 
       FROM player_loot_inventory 
       WHERE user_id = ? AND deleted_at > ? AND deleted_at IS NOT NULL`,
      [userId, sinceTimestamp]
    );

    return {
      added: addedOrUpdated.filter(item => item.obtainedAt > sinceTimestamp),
      updated: addedOrUpdated.filter(item => item.obtainedAt <= sinceTimestamp),
      deleted: removed.map(item => item.id),
      lastSync: Date.now()
    };
  }

  async clearUserLootInventory(userId) {
    // PHASE 3: Soft delete instead of hard delete for delta tracking
    const now = Date.now();
    await this.run(
      'UPDATE player_loot_inventory SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL',
      [now, now, userId]
    );
  }

  // PHASE 3: Hard delete method for cleanup
  async hardDeleteUserLootInventory(userId) {
    await this.run('DELETE FROM player_loot_inventory WHERE user_id = ?', [userId]);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

const db = new Database();

async function initializeDatabase() {
  await db.initialize();
}

module.exports = { db, initializeDatabase };
