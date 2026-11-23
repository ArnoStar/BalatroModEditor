// The item being edited: where it is in the package, and its changes.
import { useCallback, useMemo } from 'react';
import { item_look, useCatalog, type PickItem } from '@/entities/catalog';
import { useProject } from '@/entities/project';
import {
  full_key, is_object, path_str, rename_field, type AnyItem, type ItemKind, type ModPackage, type Path, type Seg,
} from '@/shared/lib/mod';
import type { LiteralKind, LiteralOption } from '@/shared/ui';

export function use_item(kind: ItemKind, index: number) {
  const { pkg, set, change } = useProject();
  const list = (pkg[kind] ?? []) as AnyItem[];
  const item = list[index] as any;
  const p = useCallback((...rest: Seg[]): Path => [kind, index, ...rest], [kind, index]);
  const ps = useCallback((...rest: Seg[]) => path_str([kind, index, ...rest]), [kind, index]);
  /** set a field of the item (undefined removes it) */
  const put = useCallback((field: string, value: unknown) => set([kind, index, field], value), [set, kind, index]);
  /** change the whole item */
  const edit = useCallback((f: (it: any) => any, coalesce?: string) => change((pkg) => {
    const l = ((pkg[kind] ?? []) as AnyItem[]).slice();
    l[index] = f(l[index]);
    return { ...pkg, [kind]: l } as ModPackage;
  }, coalesce), [change, kind, index]);
  return { pkg, item, list, p, ps, put, edit };
}

/** the item's config value renamed, in its expressions too (and the "change values" actions) */
export function rename_config(item: any, from: string, to: string): any {
  const walk = (x: any): any => {
    if (typeof x === 'string') return rename_field(x, 'self', from, to);
    if (Array.isArray(x)) return x.map(walk);
    if (is_object(x)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(x)) {
        if (k === 'set' && is_object(v)) out[k] = Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk === from ? to : kk, walk(vv)]));
        else out[k] = walk(v);
      }
      return out;
    }
    return x;
  };
  const { config, ...rest } = item ?? {};
  const renamed = walk(rest);
  if (is_object(config)) renamed.config = Object.fromEntries(Object.entries(config).map(([k, v]) => [k === from ? to : k, v]));
  return renamed;
}

/** the strings an expression may compare with: the game's keys and the mod's own */
export function use_literals(): (kind: LiteralKind) => LiteralOption[] {
  const cat = useCatalog();
  const { pkg } = useProject();
  return useMemo(() => {
    const own = (k: ItemKind) => ((pkg[k] ?? []) as AnyItem[]).filter((x) => typeof x?.key === 'string')
      .map((x) => ({ value: full_key(pkg.id, k, x.key), label: x.name }));
    const game = (kinds: Parameters<typeof cat.items>[0][]) => kinds.flatMap((k) => cat.items(k).map((x) => ({ value: x.key, label: x.name })));
    return (kind: LiteralKind): LiteralOption[] => {
      switch (kind) {
        case 'joker': return [...own('jokers'), ...game(['jokers'])];
        case 'voucher': return [...own('vouchers'), ...game(['vouchers'])];
        case 'blind': return [...own('blinds'), ...game(['blinds']), { value: 'bl_small' }, { value: 'bl_big' }];
        case 'tag': return game(['tags']);
        case 'key': return [...own('jokers'), ...own('consumables'), ...own('vouchers'), ...game(['jokers', 'tarots', 'planets', 'spectrals', 'vouchers', 'enhancements']), { value: 'c_base' }];
        case 'hand': return [];
        default: return [];
      }
    };
  }, [cat, pkg]);
}

/** the mod's own items of a kind, as a picker lists them */
export function use_own_items(kind: ItemKind, filter?: (it: any) => boolean): PickItem[] {
  const { pkg } = useProject();
  const cat = useCatalog();
  return useMemo(() => ((pkg[kind] ?? []) as AnyItem[]).filter((x) => typeof x?.key === 'string' && (!filter || filter(x))).map((x) => {
    const look = item_look(kind, x, pkg.assets, cat);
    return {
      key: full_key(pkg.id, kind, x.key), name: x.name || x.key, group: 'mod', picture: look.picture ?? undefined, chip: look.chip,
      set: (x as { set?: string }).set,
    };
  }), [pkg, kind, filter, cat]);
}
