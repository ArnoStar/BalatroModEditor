// The game API (BalatroWebAPI) and the identity service: every request the
// editor makes goes through here, with the player's access token.
import { API_BASE, IDENTITY_BASE } from '@/shared/config';
import type { ModPackage } from '@/shared/lib/mod';
import { read_json } from './problem';
import { authorized_fetch } from './session';
import type {
  Account, ActionResult, Catalog, CreativeCommand, GameView, HandPreview, Health, ModCheck, ModDetailView, ModListView,
  ModSummaryView, NewGame, PlayerAction,
} from './types';

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await authorized_fetch(`${API_BASE}/api/v1${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return read_json<T>(res);
}

const q = (params: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
  return p.size ? `?${p}` : '';
};

export const game_api = {
  health: () => fetch(`${API_BASE}/api/v1/health`).then((res) => read_json<Health>(res)),
  catalog: () => fetch(`${API_BASE}/api/v1/catalog`).then((res) => read_json<Catalog>(res)),
};

/** the mod registry: check, publish, browse, download */
export const mods_api = {
  validate: (pkg: unknown, signal?: AbortSignal) => request<ModCheck>('POST', '/mods/validate', pkg, signal),
  publish: (pkg: ModPackage) => request<ModDetailView>('POST', '/mods', pkg),
  list: (params: { q?: string; tag?: string; sort?: string; mine?: boolean; limit?: number; offset?: number } = {}) =>
    request<ModListView>('GET', `/mods${q(params)}`),
  get: (id: string) => request<ModDetailView>('GET', `/mods/${encodeURIComponent(id)}`),
  download: (id: string, version?: string) =>
    request<ModPackage>('GET', `/mods/${encodeURIComponent(id)}/package${q({ version })}`),
  install: (id: string) => request<ModSummaryView>('POST', `/mods/${encodeURIComponent(id)}/install`),
  unlist: (id: string) => request<void>('DELETE', `/mods/${encodeURIComponent(id)}`),
};

/** runs: the test bench plays a mod in the real engine */
export const games_api = {
  create: (body: NewGame) => request<GameView>('POST', '/games', body),
  get: (id: string) => request<GameView>('GET', `/games/${id}`),
  act: (id: string, action: PlayerAction & { expected_version?: number }) => request<ActionResult>('POST', `/games/${id}/actions`, action),
  preview: (id: string, cards: number[]) => request<HandPreview>('POST', `/games/${id}/preview`, { cards }),
  creative: (id: string, cmd: CreativeCommand & { expected_version?: number }) => request<ActionResult>('POST', `/games/${id}/creative`, cmd),
  remove: (id: string) => request<void>('DELETE', `/games/${id}`),
};

export const identity_api = {
  me: async (): Promise<Account> => read_json<Account>(await authorized_fetch(`${IDENTITY_BASE}/auth/me`)),
};
