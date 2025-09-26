/* Seed 30 test users with varied stats (levels, gold, sessions, avatars) */
const { db, initializeDatabase } = require('../database/db');
const crypto = require('crypto');

async function ensureUser(username, password, avatarUrl) {
  const existing = await db.getUserByUsername(username);
  if (existing) {
    // Update avatar if provided
    if (avatarUrl) {
      await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, existing.id]);
    }
    return existing.id;
  }
  const userId = await db.createUser(username, null, password);
  if (avatarUrl) {
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
  }
  return userId;
}

function randomAvatar(i) {
  // 50% URL avatar, 50% emoji key fallback used by client
  if (Math.random() < 0.5) {
    const id = 1 + ((i * 7) % 70); // stable-ish id 1..70
    return `https://i.pravatar.cc/120?img=${id}`;
  }
  const emojis = ['default', 'red', 'green', 'yellow', 'purple', 'orange'];
  return emojis[i % emojis.length];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newSessionId(userId) {
  return `sess_${userId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

async function seed() {
  await initializeDatabase();

  const baseNames = [
    'alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet',
    'kilo','lima','mike','november','oscar','papa','quebec','romeo','sierra','tango',
    'uniform','victor','whiskey','xray','yankee','zulu','atlas','nova','lyra','vega'
  ];

  const created = [];

  for (let i = 0; i < 30; i++) {
    const username = `${baseNames[i]}_${i+1}`;
    const password = 'Test1234!';
    const avatar = randomAvatar(i);
    const userId = await ensureUser(username, password, avatar);

    // Mark some users online randomly
    const isOnline = Math.random() < 0.35;
    await db.setUserOnline(userId, isOnline ? 1 : 0);

    // Create 1-3 sessions with scores
    const sessionCount = randInt(1, 3);
    for (let s = 0; s < sessionCount; s++) {
      const sessionId = newSessionId(userId);
      await db.createGameSession(userId, sessionId);

      // Levels distribution: some low, some mid, some high
      const baseLevel = randInt(0, 18);
      const extra = Math.random() < 0.25 ? randInt(5, 20) : 0; // occasional high run
      const level = Math.min(100, baseLevel + extra);
      const score = level; // scoreboard currently uses level as score surrogate
      const gold = randInt(0, 5000);
      await db.submitScore(userId, sessionId, level, score, gold);
      // Optionally end session
      await db.endGameSession(sessionId);
    }

    created.push({ userId, username, avatar });
  }

  // Refresh leaderboard
  await db.updateLeaderboard();

  console.log(`Seeded ${created.length} users.`);
  created.slice(0, 5).forEach(u => console.log(' -', u.username, u.avatar));

  // Close DB
  db.close();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  try { db.close(); } catch(_) {}
  process.exit(1);
});


