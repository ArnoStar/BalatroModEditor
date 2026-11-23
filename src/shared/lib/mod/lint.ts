// Everything the editor says about a package: the engine's checks (spec.ts),
// the keys the engine looks up when it plays the package (a joker a deck
// starts with, a tag an action gives ...), and the editor's own advice
// (warnings: the engine plays these packages, but they are likely mistakes).
import type { Issue } from './issues.ts';
import { vars_in } from './markup.ts';
import { is_object } from './py.ts';
import { full_key, KINDS, references, validate, type ItemKind } from './spec.ts';

/** the keys the game has (its catalog): null when it isn't known yet (the references aren't checked then) */
export type KnownKeys = ReadonlySet<string> | null;

/** every game key the package's own items have */
export function own_keys(pkg: Record<string, any>): Set<string> {
  const out = new Set<string>();
  if (typeof pkg.id !== 'string') return out;
  for (const kind of KINDS) for (const it of Array.isArray(pkg[kind]) ? pkg[kind] : []) {
    if (is_object(it) && typeof it.key === 'string') out.add(full_key(pkg.id, kind, it.key));
  }
  return out;
}

function hints(pkg: Record<string, any>): Issue[] {
  const out: Issue[] = [];
  const warn = (path: string, msg: Issue['msg']) => out.push({ path, msg, level: 'warning' });
  const used_assets = new Set<string>();
  const made = new Set<string>();
  const id = typeof pkg.id === 'string' ? pkg.id : '';
  for (const kind of KINDS) {
    const list: unknown[] = Array.isArray(pkg[kind]) ? pkg[kind] : [];
    list.forEach((it, i) => {
      if (!is_object(it)) return;
      const p = `${kind}[${i}]`;
      if (typeof it.sprite === 'string') used_assets.add(it.sprite);
      if (it.sprite === undefined && (kind === 'jokers' || kind === 'consumables' || kind === 'vouchers')) warn(`${p}.sprite`, { k: 'hint_no_art' });
      if (kind === 'decks' && typeof it.sprite === 'string') warn(`${p}.sprite`, { k: 'hint_deck_image' });
      const text: string[] = Array.isArray(it.text) ? it.text.filter((l: unknown) => typeof l === 'string') : [];
      const vars: unknown[] = Array.isArray(it.vars) ? it.vars : [];
      const shown = vars_in(text);
      for (const n of [...shown].sort((a, b) => a - b)) if (n > vars.length || n < 1) warn(`${p}.text`, { k: 'hint_missing_var', n });
      vars.forEach((_, n) => { if (!shown.has(n + 1)) warn(`${p}.vars[${n}]`, { k: 'hint_unused_var', n: n + 1 }); });
      const planet_with_hand = kind === 'consumables' && it.set === 'Planet' && typeof it.hand === 'string';
      if (!text.some((l) => l.trim()) && !planet_with_hand) warn(`${p}.text`, { k: 'hint_no_description' });
      if (kind === 'jokers') {
        const effects = Array.isArray(it.effects) ? it.effects : [];
        const passive = is_object(it.passive) ? Object.keys(it.passive) : [];
        if (!effects.length && !passive.length) warn(`${p}.effects`, { k: 'hint_does_nothing' });
      }
      const max_ante = typeof it.max_ante === 'number' ? it.max_ante : 10;
      if (kind === 'blinds' && typeof it.min_ante === 'number' && it.min_ante > max_ante) {
        warn(`${p}.min_ante`, { k: 'hint_ante_range' });
      }
    });
  }
  // what makes the jokers that the shop doesn't sell
  for (const d of Array.isArray(pkg.decks) ? pkg.decks : []) for (const k of Array.isArray(d?.jokers) ? d.jokers : []) made.add(String(k));
  for (const [, key] of references(pkg)) made.add(key);
  (Array.isArray(pkg.jokers) ? pkg.jokers : []).forEach((j: any, i: number) => {
    if (is_object(j) && j.in_shop === false && typeof j.key === 'string' && !made.has(full_key(id, 'jokers' as ItemKind, j.key))) {
      warn(`jokers[${i}].in_shop`, { k: 'hint_never_made' });
    }
  });
  if (is_object(pkg.assets)) for (const name of Object.keys(pkg.assets)) if (!used_assets.has(name)) warn(`assets.${name}`, { k: 'hint_unused_asset' });
  return out;
}

/** The package's problems: errors first (the engine's, in its order), then the editor's warnings. */
export function check_package(pkg: unknown, known: KnownKeys): Issue[] {
  const issues = validate(pkg);
  if (!is_object(pkg)) return issues;
  if (known) {
    const own = own_keys(pkg);
    const errors_at = new Set(issues.map((i) => i.path));
    for (const [path, key] of references(pkg)) {
      if (!errors_at.has(path) && !known.has(key) && !own.has(key)) issues.push({ path, msg: { k: 'no_such_key', key }, level: 'error' });
    }
  }
  return [...issues, ...hints(pkg)];
}
