// Who is here: the signed-in player (the identity service's account, from the
// session the portal keeps), and whether the API needs sign-in at all (a
// development server runs without it).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { game_api, identity_api, read_session, SESSION_KEY, ProblemError, type Account } from '@/shared/api';
import { portal } from '@/shared/config';

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in';

export interface SessionValue {
  status: SessionStatus;
  account: Account | null;
  /** the API's sign-in: required, off (anyone acts as the local player), or unknown (it can't be reached) */
  auth: 'required' | 'off' | 'unknown';
  /** whether the API accepts this player's requests (signed in, or sign-in off) */
  can_act: boolean;
  /** the portal's sign-in page, coming back here */
  sign_in_url: string;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [auth, setAuth] = useState<SessionValue['auth']>('unknown');

  const load = useCallback(async () => {
    if (!read_session()) { setAccount(null); setStatus('signed-out'); return; }
    try {
      setAccount(await identity_api.me());
      setStatus('signed-in');
    } catch (e) {
      setAccount(null);
      setStatus(e instanceof ProblemError && e.status === 401 ? 'signed-out' : 'signed-out');
    }
  }, []);

  useEffect(() => {
    void load();
    const on_storage = (e: StorageEvent) => { if (e.key === SESSION_KEY || e.key === null) void load(); };
    window.addEventListener('storage', on_storage);
    return () => window.removeEventListener('storage', on_storage);
  }, [load]);

  useEffect(() => {
    game_api.health().then((h) => setAuth(h.auth), () => setAuth('unknown'));
  }, []);

  const value = useMemo<SessionValue>(() => ({
    status,
    account,
    auth,
    can_act: auth === 'off' || status === 'signed-in',
    sign_in_url: portal(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`),
  }), [status, account, auth]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
