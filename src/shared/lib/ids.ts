// Names for new things: a project's id, and keys made from names ("Cherry
// Seven" -> cherry_seven), unique among the ones taken.

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

/** lowercase letters, digits and _, starting with a letter, at most `max` long */
export function slug(name: string, max = 32, fallback = 'item'): string {
  let s = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(s)) s = fallback + (s ? '_' + s : '');
  return s.slice(0, max).replace(/_+$/, '') || fallback;
}

/** `base`, or base_2, base_3 ... the first not taken (at most `max` long) */
export function unique(base: string, taken: Iterable<string>, max = 32): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = base.slice(0, max - suffix.length) + suffix;
    if (!set.has(candidate)) return candidate;
  }
}
