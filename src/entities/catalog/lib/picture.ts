// What an item of a mod looks like in the game: its image, a cell of the
// game's art, or the game's default for its kind (as the game's front end
// draws mod items: entities/mod/model/apply.ts there).
import type { CardPicture } from '@/shared/ui';
import type { ItemKind } from '@/shared/lib/mod';
import type { CatalogValue } from '../model/catalog';

/** the game's default art for an item of a mod without a picture */
export const DEFAULT_ART: Record<string, string> = {
  jokers: 'j_joker', Tarot: 'c_fool', Planet: 'c_pluto', Spectral: 'c_aura', vouchers: 'v_blank', decks: 'b_red',
};

export interface ItemLook {
  picture: CardPicture | null;
  /** a blind's chip: its row in the game's sheet, its colour */
  chip?: { y: number; colour?: string };
  /** the picture is the game's default (the item has none) */
  fallback: boolean;
}

export function item_look(kind: ItemKind, item: any, assets: Record<string, string> | undefined, cat: CatalogValue): ItemLook {
  const s = item?.sprite;
  if (kind === 'blinds') {
    const key = s && typeof s === 'object' && typeof s.blind === 'string' ? s.blind : 'bl_hook';
    const b = cat.catalog?.blinds.find((x) => x.key === key) ?? cat.catalog?.blinds.find((x) => x.key === 'bl_hook');
    return { picture: null, chip: { y: b?.sprite?.pos.y ?? 7, colour: item?.colour ?? b?.colour ?? '#b44430' }, fallback: !s };
  }
  if (typeof s === 'string' && kind !== 'decks') {
    const url = assets?.[s];
    if (url) return { picture: { image: url }, fallback: false };
  }
  if (s && typeof s === 'object' && 'atlas' in s && !(kind === 'decks' && s.atlas !== 'centers')) {
    return { picture: { atlas: kind === 'decks' ? 'centers' : String(s.atlas), x: Number(s.x) || 0, y: Number(s.y) || 0 }, fallback: false };
  }
  const def = kind === 'consumables' ? DEFAULT_ART[item?.set ?? 'Tarot'] ?? 'c_fool' : DEFAULT_ART[kind];
  return { picture: def ? cat.picture(def) : null, fallback: true };
}
