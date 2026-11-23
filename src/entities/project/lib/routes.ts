// Where in the editor a place of the package is edited: `jokers[2].effects[0].if`
// is the third joker's page.
import type { ItemKind } from '@/shared/lib/mod';

const ITEM = /^(jokers|consumables|vouchers|decks|blinds)\[(\d+)\]/;

/** the editor's page (under the project) for a place of the package */
export function route_of(path: string): string {
  const m = ITEM.exec(path);
  if (m) return `${m[1]}/${m[2]}`;
  if (path.startsWith('assets')) return 'art';
  return '';
}

/** the item a place belongs to */
export function item_of(path: string): { kind: ItemKind; index: number } | null {
  const m = ITEM.exec(path);
  return m ? { kind: m[1] as ItemKind, index: Number(m[2]) } : null;
}

/** scroll to the field that edits a place (the longest `data-path` that starts it) and make it shine */
export function focus_path(path: string, tries = 12) {
  const all = [...document.querySelectorAll<HTMLElement>('[data-path]')];
  let best: HTMLElement | null = null;
  for (const el of all) {
    const p = el.dataset.path ?? '';
    if (path === p || path.startsWith(p + '.') || path.startsWith(p + '[') || (p === '' && !best)) {
      if (!best || p.length > (best.dataset.path ?? '').length) best = el;
    }
  }
  if (!best || (best.dataset.path === '' && tries > 0)) {
    if (tries > 0) setTimeout(() => focus_path(path, tries - 1), 60);
    if (!best) return;
  }
  best.scrollIntoView({ behavior: 'smooth', block: 'center' });
  best.classList.remove('is-flash');
  void best.offsetWidth;
  best.classList.add('is-flash');
  const input = best.querySelector<HTMLElement>('input, textarea, select, button');
  input?.focus({ preventScroll: true });
}
