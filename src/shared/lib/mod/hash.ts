// A package's content hash, as the API computes it (BalatroWebAPI
// domain/mods.py package_hash): sha256 of its canonical JSON (sorted keys, no
// spaces, UTF-8). Two equal packages have the same; the game's library and
// the registry name packages by it.
import { py_dumps } from './py.ts';

export function canonical_json(pkg: unknown): string {
  return py_dumps(pkg, { compact: true, sort: true });
}

export async function package_hash(pkg: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical_json(pkg)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
