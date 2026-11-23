// Places in a package: as a list of keys and indices (['jokers', 0, 'effects',
// 1, 'if']) for changing it, and as the engine writes them in its messages
// (`jokers[0].effects[1].if`) for finding a problem's field. Changes are
// immutable: a changed package shares everything it didn't change.

export type Seg = string | number;
export type Path = readonly Seg[];

/** `jokers[0].effects[1].if` */
export function path_str(path: Path): string {
  let out = '';
  for (const s of path) out += typeof s === 'number' ? `[${s}]` : out ? `.${s}` : s;
  return out;
}

export function get_in(root: unknown, path: Path): any {
  let x: any = root;
  for (const s of path) {
    if (x === null || x === undefined) return undefined;
    x = x[s as any];
  }
  return x;
}

/** the value at `path` replaced (undefined: removed); missing objects on the way are made */
export function set_in<T>(root: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [head, ...rest] = path;
  const base: any = root ?? (typeof head === 'number' ? [] : {});
  const next = set_in(base[head as any], rest, value);
  if (Array.isArray(base)) {
    const copy = base.slice();
    if (next === undefined && typeof head === 'number') copy.splice(head, 1);
    else copy[head as number] = next;
    return copy as T;
  }
  const copy = { ...base };
  if (next === undefined) delete copy[head as string];
  else copy[head as string] = next;
  return copy as T;
}

export function update_in<T>(root: T, path: Path, fn: (v: any) => unknown): T {
  return set_in(root, path, fn(get_in(root, path)));
}

/** a list with `value` put in at `index` */
export function inserted<T>(list: readonly T[] | undefined, index: number, value: T): T[] {
  const copy = (list ?? []).slice();
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, value);
  return copy;
}

/** a list with the entry at `from` moved to `to` */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [x] = copy.splice(from, 1);
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, x);
  return copy;
}

/** an object without its undefined, empty-string and empty-list fields (what is written to the package) */
export function compact<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return out as T;
}
