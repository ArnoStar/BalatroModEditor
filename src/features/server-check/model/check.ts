// The server's check of a package (POST /mods/validate): the engine's format
// checks, then a short run played on each of its decks.
import { useCallback, useState } from 'react';
import { useProject } from '@/entities/project';
import { mods_api } from '@/shared/api';

/** a server error's place in the package and its message (`mod 'x': jokers[0].cost: must be …`) */
export function split_error(e: string): { path: string | null; text: string } {
  const m = /^(?:mod '[^']*': )?((?:jokers|consumables|vouchers|decks|blinds)\[\d+\][^:]*|[a-z_]+(?:\.[A-Za-z0-9_.-]+)?): (.*)$/.exec(e);
  return m ? { path: m[1], text: m[2] } : { path: null, text: e };
}

export function use_server_check() {
  const { pkg, server, set_server } = useProject();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const c = await mods_api.validate(pkg);
      set_server({ pkg, valid: c.valid, errors: c.errors, hash: c.hash, at: Date.now() });
      return c;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setRunning(false);
    }
  }, [pkg, set_server]);
  return { run, running, error, result: server, stale: server !== null && server.pkg !== pkg };
}
