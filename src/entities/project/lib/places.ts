// A place of the package in the player's words: `jokers[0].effects[1].if` is
// "Cherry Seven · effect 2 · If".
import type { Messages } from '@/shared/i18n';
import { KINDS, type ItemKind, type ModPackage } from '@/shared/lib/mod';

export function segments(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /\[(\d+)\]|\.?([^.[\]]+)/g;
  for (let m = re.exec(path); m; m = re.exec(path)) out.push(m[1] !== undefined ? Number(m[1]) : m[2]);
  return out;
}

export interface Place { item: string | null; kind: ItemKind | null; field: string }

export function place_of(path: string, pkg: ModPackage, t: Messages): Place {
  const seg = segments(path);
  if (!seg.length) return { item: null, kind: null, field: t.places.package };
  const head = seg[0];
  if (typeof head === 'string' && (KINDS as string[]).includes(head) && typeof seg[1] === 'number') {
    const kind = head as ItemKind;
    const it = (pkg[kind] as { name?: string; key?: string }[] | undefined)?.[seg[1]];
    const item = it?.name || it?.key || `${t.kinds[kind].one} ${seg[1] + 1}`;
    return { item, kind, field: field_words(seg.slice(2), t) };
  }
  if (head === 'assets') return { item: null, kind: null, field: `${t.places.assets} · ${seg.slice(1).join('.')}` };
  const first = (t.places as unknown as Record<string, unknown>)[String(head)];
  return { item: null, kind: null, field: [typeof first === 'string' ? first : String(head), ...seg.slice(1).map(String)].join(' · ') };
}

function field_words(rest: (string | number)[], t: Messages): string {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const s = rest[i];
    const prev = rest[i - 1];
    if (typeof s === 'number') {
      if (prev === 'effects') out[out.length - 1] = t.places.effect(s + 1);
      else if (prev === 'text') out.push(t.places.line(s + 1));
      else if (prev === 'vars') out[out.length - 1] = t.places.value(s + 1);
      else if (prev === 'do' || prev === 'else' || prev === 'use' || prev === 'redeem' || prev === 'on_set' || prev === 'on_hand') out.push(t.places.action(s + 1));
      else out.push(String(s + 1));
    } else {
      out.push(t.places.fields[s] ?? s);
    }
  }
  return out.join(' · ');
}

/** how many items of each kind, and whether it has rules or creative mode */
export function summary_of(pkg: ModPackage) {
  return {
    jokers: pkg.jokers?.length ?? 0,
    consumables: pkg.consumables?.length ?? 0,
    vouchers: pkg.vouchers?.length ?? 0,
    decks: pkg.decks?.length ?? 0,
    blinds: pkg.blinds?.length ?? 0,
    assets: Object.keys(pkg.assets ?? {}).length,
    rules: !!pkg.rules && Object.keys(pkg.rules).length > 0,
    creative: !!pkg.creative,
  };
}
