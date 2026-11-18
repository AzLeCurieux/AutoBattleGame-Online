import { z } from 'zod';
import { GAME_MODES, type GameMode } from './engine/types.js';
import { MAX_PALIER } from './rules.js';

/** Every action a client may send. Validated on the server before reaching the engine. */
export const RunActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fight') }),
  z.object({ type: z.literal('chooseUpgrade'), index: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal('heal') }),
  z.object({ type: z.literal('shopBuy'), index: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal('shopSell'), index: z.number().int().min(0).max(19) }),
  z.object({ type: z.literal('shopLeave') }),
  z.object({ type: z.literal('deckMove'), from: z.number().int().min(0).max(19), to: z.number().int().min(0).max(19) }),
  z.object({ type: z.literal('shopReroll') }),
  z.object({ type: z.literal('shopBuyPack'), index: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal('shopBuyPerk') }),
  z.object({ type: z.literal('shopForge') }),
  z.object({ type: z.literal('bossReroll') }),
  z.object({ type: z.literal('packPick'), index: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal('packSkip') }),
  z.object({ type: z.literal('chooseNode'), index: z.number().int().min(0).max(4) }),
  z.object({ type: z.literal('useItem'), index: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal('shopBuyItem') }),
  z.object({ type: z.literal('newRun'), mode: z.enum(GAME_MODES).optional(), palier: z.number().int().min(1).max(MAX_PALIER).optional() }),
]);
export type RunAction = z.infer<typeof RunActionSchema>;

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const PIN_RE = /^\d{4}$/;
export const MIN_PASSWORD_LENGTH = 8;

/** 'default' = generated letter avatar (as in v1). Otherwise an https image URL. */
export type Avatar = string;
export const DEFAULT_AVATAR = 'default';
const AvatarValue = z.union([
  z.literal(DEFAULT_AVATAR),
  z.url({ protocol: /^https$/, error: 'URL https uniquement' }).max(500),
]);

const Username = z.string().trim().regex(USERNAME_RE, 'Lettres, chiffres et _ uniquement (3 à 20 caractères)');

export const CredentialsSchema = z.object({
  username: Username,
  password: z.string().min(1).max(128),
});

/** v1 offered a 4-digit PIN or a password; both are kept, with server-side lockout. */
export const RegisterSchema = z
  .object({ username: Username, password: z.string().max(128), isPin: z.boolean().default(false) })
  .superRefine((v, ctx) => {
    if (v.isPin && !PIN_RE.test(v.password)) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Le PIN doit contenir exactement 4 chiffres' });
    }
    if (!v.isPin && v.password.length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
      });
    }
  });

export const AvatarSchema = z.object({ avatar: AvatarValue });

export const OpenManySchema = z.object({
  caseId: z.string().min(1).max(20),
  count: z.number().int().min(1).max(10),
});

export interface PublicUser {
  id: number;
  username: string;
  avatar: Avatar;
  role: 'player' | 'admin';
  bestLevel: number;
}

/** Entry of the "Qui joue aujourd'hui ?" profile picker. */
export interface ProfileListEntry {
  username: string;
  avatar: Avatar;
  hasPin: boolean;
}

export interface ProfileStats {
  bestLevel: number;
  bestLevelClassic: number;
  totalGold: number;
  gamesPlayed: number;
  /** Finished runs that had beaten the last act. */
  wins: number;
  /** Highest difficulty tier the player may start a deck run on. */
  palierUnlocked: number;
  casesFound: number;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  avatar: Avatar;
  /** Best level reached in the requested mode. */
  bestLevel: number;
  gamesPlayed: number;
  /** Deck runs won (act 8 boss beaten). Always 0 in the classic board. */
  wins: number;
  /** Highest tier won (0 = none). Always 0 in the classic board. */
  palierWon: number;
}

export interface OnlinePlayer {
  userId: number;
  username: string;
  avatar: Avatar;
  currentLevel: number;
  mode: GameMode;
}

export interface LeaderboardSnapshot {
  top: Record<GameMode, LeaderboardEntry[]>;
  online: OnlinePlayer[];
}

export interface InventoryCase {
  id: number;
  caseId: string;
  obtainedAt: number;
}

export interface InventoryCard {
  cardId: string;
  count: number;
  lastObtainedAt: number;
}

export interface InventoryResponse {
  cards: InventoryCard[];
  cases: InventoryCase[];
}

export interface CaseOpening {
  caseRowId: number;
  caseId: string;
  cardId: string;
  isNew: boolean;
}

export interface MonitoringSample {
  time: number;
  cpu: number;
  mem: number;
  users: number;
  sessions: number;
  netIn: number;
  netOut: number;
}

/** /api/admin/stats — same shape the v1 monitoring page consumed. Admin role only. */
export interface AdminStats {
  system: {
    uptime: number;
    cpuLoad: number;
    loadavg: number[];
    memory: { active: number; total: number; heapUsed: number; rss: number };
    disk: { percent: string; used: string; total: string } | null;
    nodeVersion: string;
    platform: string;
    arch: string;
    ports: number[];
  };
  process: { pid: number };
  socket: { connected: number };
  game: { activeUsers: number; activeSessions: number; leaderboardSize: number };
  network: { bytesIn: number; bytesOut: number };
  plugins: { name: string; status: string; details: string }[];
  history: MonitoringSample[];
}

/** Events pushed by the server over Socket.IO. */
export interface ServerToClientEvents {
  'leaderboard:update': (snapshot: LeaderboardSnapshot) => void;
  'run:sync': () => void;
  'inventory:sync': () => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}
