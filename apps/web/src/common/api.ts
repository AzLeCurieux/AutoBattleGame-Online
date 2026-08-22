import type {
  ActionResult,
  AdminStats,
  CaseOpening,
  InventoryResponse,
  LeaderboardSnapshot,
  ProfileListEntry,
  ProfileStats,
  PublicRunState,
  PublicUser,
  RunAction,
} from '@autobattle/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'HTTP', data?.message ?? 'Erreur de connexion');
  return data as T;
}

export interface ActResponse {
  state: PublicRunState;
  fight: ActionResult['fight'] | null;
  newBest: boolean;
  /** Difficulty tier this action's victory just unlocked. */
  palierUnlocked?: number | null;
}

export const api = {
  profiles: () => request<ProfileListEntry[]>('GET', '/api/auth/users'),
  login: (username: string, password: string) => request<PublicUser>('POST', '/api/auth/login', { username, password }),
  register: (username: string, password: string, isPin: boolean) =>
    request<PublicUser>('POST', '/api/auth/register', { username, password, isPin }),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout', {}),
  me: () => request<PublicUser>('GET', '/api/auth/me'),
  stats: () => request<ProfileStats>('GET', '/api/me/stats'),
  setAvatar: (avatar: string) => request<PublicUser>('PUT', '/api/me/avatar', { avatar }),
  run: () => request<PublicRunState>('GET', '/api/run'),
  act: (action: RunAction) => request<ActResponse>('POST', '/api/run/action', action),
  inventory: () => request<InventoryResponse>('GET', '/api/inventory'),
  openMany: (caseId: string, count: number) => request<CaseOpening[]>('POST', '/api/cases/open-many', { caseId, count }),
  leaderboard: () => request<LeaderboardSnapshot>('GET', '/api/leaderboard'),
  adminStats: () => request<AdminStats>('GET', '/api/admin/stats'),
};
