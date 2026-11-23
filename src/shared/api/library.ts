// The game's mod library, written from here: the mods the player installed in
// the game (BalatroFrontEnd src/entities/mod/model/library.ts: keep the two in
// step). The game keeps them in this origin's IndexedDB, so a mod installed
// from the editor is in the game's MODS menu, on, for the next run.
import type { ModPackage } from '@/shared/lib/mod';

export interface InstalledMod {
  id: string;
  version: string;
  /** the package's content hash, as the API computes it */
  hash: string;
  name: string;
  enabled: boolean;
  /** registry: installed from the API's registry (it has the package); file: imported (here: from the editor) */
  source: 'registry' | 'file';
  official?: boolean;
  installed_at: number;
  package: ModPackage;
}

const DB = 'balatro-fe.mods';
const STORE = 'installed';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // (no version: the game's, whatever it is; made at version 1 as the game makes it when it isn't there)
    const req = indexedDB.open(DB);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = f(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

export const game_library = {
  list: async () => (await tx('readonly', (s) => s.getAll() as IDBRequest<InstalledMod[]>)).sort((a, b) => a.installed_at - b.installed_at),
  get: (id: string) => tx('readonly', (s) => s.get(id) as IDBRequest<InstalledMod | undefined>),
  put: (m: InstalledMod) => tx('readwrite', (s) => s.put(m)).then(() => undefined),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined),
};
