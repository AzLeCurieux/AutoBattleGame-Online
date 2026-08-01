import type { FastifyInstance } from 'fastify';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRun } from '@autobattle/shared';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase, type Db } from '../src/db/index.js';

const ORIGIN = 'http://localhost:5173';
let app: FastifyInstance;
let db: Db;

beforeEach(async () => {
  db = openDatabase(':memory:');
  app = await buildApp(loadConfig({ NODE_ENV: 'test', APP_ORIGIN: ORIGIN }), db);
});
afterEach(async () => {
  await app.close();
  db.close();
});

async function register(username = 'alice', password = 'correct horse', isPin = false) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { origin: ORIGIN },
    payload: { username, password, isPin },
  });
  const cookie = res.cookies.find((c) => c.name === 'sid');
  return { res, cookie: cookie ? `sid=${cookie.value}` : '' };
}

const post = (url: string, cookie: string, payload?: object) =>
  app.inject({ method: 'POST', url, headers: { origin: ORIGIN, cookie }, ...(payload ? { payload } : {}) });

describe('auth', () => {
  it('registers with an httpOnly SameSite=Strict cookie and never returns the hash', async () => {
    const { res } = await register();
    expect(res.statusCode).toBe(201);
    const cookie = res.cookies.find((c) => c.name === 'sid')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(res.body).not.toMatch(/scrypt|password/i);
  });

  it('rejects weak passwords and malformed PINs', async () => {
    expect((await register('bob', '1234')).res.statusCode).toBe(400);
    expect((await register('bob', 'abcd', true)).res.statusCode).toBe(400);
    expect((await register('bob', '12345', true)).res.statusCode).toBe(400);
    expect((await register('carol', '1234', true)).res.statusCode).toBe(201);
  });

  it('rejects duplicate usernames (case-insensitive)', async () => {
    await register('alice');
    expect((await register('ALICE')).res.statusCode).toBe(409);
  });

  it('logs in, then logout revokes the session server-side', async () => {
    await register();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN }, payload: { username: 'alice', password: 'correct horse' } });
    expect(login.statusCode).toBe(200);
    const cookie = `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(200);
    await post('/api/auth/logout', cookie);
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('gives the same error for unknown user and wrong password', async () => {
    await register();
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN }, payload: { username: 'alice', password: 'wrong password' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN }, payload: { username: 'nobody', password: 'wrong password' } });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it('lists profiles for the picker without ids, hashes or stats', async () => {
    await register('alice');
    await register('carol', '4821', true);
    const res = await app.inject({ url: '/api/auth/users' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(
      expect.arrayContaining([
        { username: 'alice', avatar: 'default', hasPin: false },
        { username: 'carol', avatar: 'default', hasPin: true },
      ]),
    );
    expect(res.body).not.toMatch(/hash|scrypt|"id"/);
  });

  it('locks an account after 5 wrong codes, even for the right PIN', async () => {
    await register('carol', '4821', true);
    const login = (password: string) =>
      app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN }, payload: { username: 'carol', password } });
    for (let i = 0; i < 5; i++) expect((await login('0000')).statusCode).toBe(401);
    const locked = await login('4821');
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error).toBe('LOCKED');
  });

  it('only accepts https avatar URLs', async () => {
    const { cookie } = await register();
    const put = (avatar: string) =>
      app.inject({ method: 'PUT', url: '/api/me/avatar', headers: { origin: ORIGIN, cookie }, payload: { avatar } });
    expect((await put('javascript:alert(1)')).statusCode).toBe(400);
    expect((await put('http://tracker.example/pixel.png')).statusCode).toBe(400);
    expect((await put('https://cdn.example/me.png')).json().avatar).toBe('https://cdn.example/me.png');
  });

  it('blocks state-changing requests from another origin (CSRF)', async () => {
    const { cookie } = await register();
    const res = await app.inject({ method: 'POST', url: '/api/run/action', headers: { origin: 'https://evil.example', cookie }, payload: { type: 'fight' } });
    expect(res.statusCode).toBe(403);
  });
});

describe('game', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ url: '/api/run' })).statusCode).toBe(401);
  });

  it('resolves fights on the server and validates actions', async () => {
    const { cookie } = await register();
    const fight = await post('/api/run/action', cookie, { type: 'fight' });
    expect(fight.statusCode).toBe(200);
    const body = fight.json();
    expect(body.fight.outcome).toBe('victory');
    expect(body.state.level).toBe(1);
    expect(body.state).not.toHaveProperty('rng');

    const wrongPhase = await post('/api/run/action', cookie, { type: 'fight' });
    expect(wrongPhase.statusCode).toBe(409);

    const forged = await post('/api/run/action', cookie, { type: 'setGold', gold: 99999 });
    expect(forged.statusCode).toBe(400);
  });

  it('updates the leaderboard from server-computed levels only', async () => {
    const { cookie } = await register();
    await post('/api/run/action', cookie, { type: 'fight' });
    expect((await app.inject({ url: '/api/leaderboard' })).statusCode).toBe(401);
    const board = (await app.inject({ url: '/api/leaderboard', headers: { cookie } })).json();
    expect(board.top.deck[0]).toMatchObject({ username: 'alice', bestLevel: 1 });
    expect(board.top.classic[0]).toMatchObject({ username: 'alice', bestLevel: 0 });

    const stats = (await app.inject({ url: '/api/me/stats', headers: { cookie } })).json();
    expect(stats).toMatchObject({ bestLevel: 1, totalGold: 1, gamesPlayed: 0, casesFound: 0 });
  });

  it('only opens cases owned by the caller', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    db.prepare("INSERT INTO user_cases (user_id, case_id, obtained_at) VALUES (1, 'alpha', 0)").run();

    expect((await post('/api/cases/1/open', bob.cookie)).statusCode).toBe(404);
    const opened = await post('/api/cases/1/open', alice.cookie);
    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toMatchObject({ caseId: 'alpha', isNew: true });
    expect((await post('/api/cases/1/open', alice.cookie)).statusCode).toBe(404);

    const inv = (await app.inject({ url: '/api/inventory', headers: { cookie: alice.cookie } })).json();
    expect(inv.cases).toHaveLength(0);
    expect(inv.cards).toHaveLength(1);
  });

  it('keeps a separate record and leaderboard for the classic mode', async () => {
    const { cookie } = await register();
    const run = (await post('/api/run/action', cookie, { type: 'newRun', mode: 'classic' })).json();
    expect(run.state.mode).toBe('classic');
    await post('/api/run/action', cookie, { type: 'fight' });
    const board = (await app.inject({ url: '/api/leaderboard', headers: { cookie } })).json();
    expect(board.top.classic[0]).toMatchObject({ username: 'alice', bestLevel: 1 });
    expect(board.top.deck[0]).toMatchObject({ bestLevel: 0 });
    const stats = (await app.inject({ url: '/api/me/stats', headers: { cookie } })).json();
    expect(stats).toMatchObject({ bestLevel: 0, bestLevelClassic: 1 });
  });

  it('locks difficulty tiers until a run is won on the tier below', async () => {
    const { cookie } = await register();
    expect((await post('/api/run/action', cookie, { type: 'newRun', mode: 'deck', palier: 2 })).statusCode).toBeGreaterThanOrEqual(400);
    // Fake a run one fight away from winning act 8, on tier 1.
    const strong = { ...createRun(7, 0, 'deck'), level: 79, nextBoss: 'thief', hp: 1e9, base: { maxHp: 1e9, damage: 1e9, critChance: 0, critDamage: 50 } };
    db.prepare('INSERT OR REPLACE INTO runs (user_id, state, updated_at) VALUES (1, ?, 0)').run(JSON.stringify(strong));
    const win = (await post('/api/run/action', cookie, { type: 'fight' })).json();
    expect(win.fight.reward.victory).toBe(true);
    expect(win.palierUnlocked).toBe(2);
    const stats = (await app.inject({ url: '/api/me/stats', headers: { cookie } })).json();
    expect(stats.palierUnlocked).toBe(2);
    const next = (await post('/api/run/action', cookie, { type: 'newRun', mode: 'deck', palier: 2 })).json();
    expect(next.state.palier).toBe(2);
  });

  it('opens several cases of one type at once, all or nothing', async () => {
    const { cookie } = await register();
    for (let i = 0; i < 3; i++) db.prepare("INSERT INTO user_cases (user_id, case_id, obtained_at) VALUES (1, 'alpha', 0)").run();
    const tooMany = await post('/api/cases/open-many', cookie, { caseId: 'alpha', count: 5 });
    expect(tooMany.statusCode).toBe(409);
    const two = await post('/api/cases/open-many', cookie, { caseId: 'alpha', count: 2 });
    expect(two.json()).toHaveLength(2);
    const inv = (await app.inject({ url: '/api/inventory', headers: { cookie } })).json();
    expect(inv.cases).toHaveLength(1);
  });

  it('keeps admin stats for admins only', async () => {
    const { cookie } = await register();
    expect((await app.inject({ url: '/api/admin/stats', headers: { cookie } })).statusCode).toBe(403);
    db.prepare("UPDATE users SET role = 'admin' WHERE username = 'alice'").run();
    const stats = await app.inject({ url: '/api/admin/stats', headers: { cookie } });
    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({ game: { leaderboardSize: 1 }, process: { pid: process.pid } });
  });
});

describe('pages', () => {
  it('serves the v1 page URLs and redirects like v1 did', async () => {
    await app.close();
    db.close();
    const dist = mkdtempSync(join(tmpdir(), 'web-'));
    for (const f of ['index', 'login', 'gambling', 'inventory', 'monitoring']) writeFileSync(join(dist, `${f}.html`), f);
    db = openDatabase(':memory:');
    app = await buildApp(loadConfig({ NODE_ENV: 'test', APP_ORIGIN: ORIGIN, WEB_DIST: dist }), db);

    const get = (url: string, cookie = '') => app.inject({ url, headers: { cookie } });
    expect((await get('/')).headers.location).toBe('/login');
    expect((await get('/gambling')).headers.location).toBe('/login');
    expect((await get('/login')).body).toBe('login');

    const { cookie } = await register();
    expect((await get('/', cookie)).body).toBe('index');
    expect((await get('/inventory', cookie)).body).toBe('inventory');
    expect((await get('/login', cookie)).headers.location).toBe('/');
    expect((await get('/monitoring', cookie)).headers.location).toBe('/');
    expect((await get('/src/../package.json', cookie)).statusCode).not.toBe(200);
  });
});
