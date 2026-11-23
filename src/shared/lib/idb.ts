// The editor's own storage in the browser (IndexedDB 'balatro-editor'): the
// player's mod projects, with their images. Not the game's library (that is
// shared/api/library.ts).

const DB = 'balatro-editor';
const VERSION = 1;
export const STORES = { projects: 'projects' } as const;

let db: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  db = db ?? new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORES.projects)) req.result.createObjectStore(STORES.projects, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { db = null; reject(req.error); };
  });
  return db;
}

export async function idb<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = f(t.objectStore(store));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error ?? r.error);
    t.onabort = () => reject(t.error ?? new Error('aborted'));
  });
}
