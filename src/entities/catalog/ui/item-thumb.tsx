import type { ItemKind } from '@/shared/lib/mod';
import { BlindChip, CardArt } from '@/shared/ui';
import { useCatalog } from '../model/catalog';
import { item_look } from '../lib/picture';

/** a mod item's picture, small (lists, trees) */
export function ItemThumb({ kind, item, assets, scale = 0.32 }: { kind: ItemKind; item: unknown; assets?: Record<string, string>; scale?: number }) {
  const cat = useCatalog();
  const look = item_look(kind, item, assets, cat);
  if (look.chip) return <BlindChip y={look.chip.y} colour={look.chip.colour} scale={scale * 1.6} />;
  return <CardArt picture={look.picture} scale={scale} className={look.fallback ? 'is-default' : undefined} />;
}
