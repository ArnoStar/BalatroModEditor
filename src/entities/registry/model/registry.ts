// The mod's record in the registry (the API's /mods): whether its id is free,
// the player's own (and its versions), another player's, or an official mod's.
import { useCallback, useEffect, useState } from 'react';
import { mods_api, ProblemError, type ModDetailView } from '@/shared/api';
import { ID_PATTERN } from '@/shared/lib/mod';

export type RegistryState =
  | { k: 'unknown' }
  | { k: 'free' }
  | { k: 'yours'; mod: ModDetailView }
  | { k: 'taken'; mod: ModDetailView }
  | { k: 'official'; mod: ModDetailView };

/** what the registry has for this id (asked again a moment after it changes, and on reload) */
export function use_registry(id: string): RegistryState & { reload: () => void } {
  const [state, setState] = useState<RegistryState>({ k: 'unknown' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!new RegExp(ID_PATTERN).test(id)) { setState({ k: 'unknown' }); return; }
    let alive = true;
    const timer = setTimeout(() => {
      mods_api.get(id).then(
        (mod) => { if (alive) setState(mod.official ? { k: 'official', mod } : mod.yours ? { k: 'yours', mod } : { k: 'taken', mod }); },
        (e) => { if (alive) setState(e instanceof ProblemError && e.status === 404 ? { k: 'free' } : { k: 'unknown' }); },
      );
    }, tick ? 0 : 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [id, tick]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { ...state, reload };
}
