// Where the other parts of the site are. By default everything is on this
// origin: the portal at /, the game at /play/, the API at /api/, the identity
// service at /identity/ (the portal's nginx, or this dev server, passes them on).

function env(name: string): string {
  return ((import.meta.env as Record<string, string | undefined>)[name] ?? '').replace(/\/$/, '');
}

/** the game API (BalatroWebAPI): `<api_base>/api/v1/...`: the catalog, the mod registry, test runs */
export const API_BASE = env('VITE_API_URL');
/** the identity service (BalatroIndentityService): the account, the session's refresh */
export const IDENTITY_BASE = env('VITE_IDENTITY_URL') || '/identity';
/** the game (BalatroFrontEnd): its sprites and texts, and where a mod is played */
export const GAME_URL = env('VITE_GAME_URL') || '/play';
/** the portal (BalatroPortal): sign-in, the account */
export const PORTAL_URL = env('VITE_PORTAL_URL');

/** a page of the portal: `portal('/login')` */
export const portal = (path: string) => `${PORTAL_URL}${path}`;
/** where this app is (its router's basename) */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
