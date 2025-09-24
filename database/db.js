const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, 'game.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
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
        is_active BOOLEAN DEFAULT 1,
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
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }
    
    // Create indexes for better performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank_position)');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
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
    await this.run(
      'INSERT INTO scores (user_id, session_id, level, score, gold) VALUES (?, ?, ?, ?, ?)',
      [userId, sessionId, level, score, gold]
    );
  }

  async getUserBestScore(userId) {
    return await this.get(
      'SELECT MAX(score) as best_score, MAX(level) as best_level FROM scores WHERE user_id = ?',
      [userId]
    );
  }

  // Leaderboard methods
  async updateLeaderboard() {
    try {
      console.log('🔄 Mise à jour du leaderboard...');
      
      // Clear current leaderboard
      await this.run('DELETE FROM leaderboard');
      console.log('✅ Ancien leaderboard supprimé');
      
      // Vérifier s'il y a des utilisateurs avec des scores
      const userCount = await this.get('SELECT COUNT(*) as count FROM users');
      const scoreCount = await this.get('SELECT COUNT(*) as count FROM scores');
      
      console.log(`📊 Utilisateurs: ${userCount.count}, Scores: ${scoreCount.count}`);
      
      if (userCount.count === 0) {
        console.log('⚠️ Aucun utilisateur trouvé, leaderboard vide');
        return;
      }
      
      // Insert updated leaderboard - Score basé sur le niveau atteint
      const result = await this.run(`
        INSERT INTO leaderboard (user_id, username, avatar, best_level, best_score, total_gold, games_played, last_activity, rank_position)
        SELECT 
          u.id,
          u.username,
          u.avatar,
          COALESCE(MAX(s.level), 0) as best_level,
          COALESCE(MAX(s.level), 0) as best_score,
          COALESCE(SUM(s.gold), 0) as total_gold,
          COUNT(DISTINCT gs.id) as games_played,
          MAX(s.timestamp) as last_activity,
          ROW_NUMBER() OVER (ORDER BY MAX(s.level) DESC, MAX(s.timestamp) DESC) as rank_position
        FROM users u
        LEFT JOIN game_sessions gs ON u.id = gs.user_id
        LEFT JOIN scores s ON u.id = s.user_id
        GROUP BY u.id, u.username, u.avatar
        ORDER BY best_level DESC, last_activity DESC
      `);
      
      console.log(`✅ Leaderboard mis à jour: ${result.changes} entrées`);
      
      // Vérifier le contenu du leaderboard
      const leaderboard = await this.all('SELECT * FROM leaderboard ORDER BY rank_position LIMIT 5');
      console.log('🏆 Top 5 du leaderboard:');
      leaderboard.forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.username} - Niveau ${player.best_level}`);
      });
      
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
      console.log(`📋 Leaderboard récupéré: ${leaderboard.length} joueurs`);
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
