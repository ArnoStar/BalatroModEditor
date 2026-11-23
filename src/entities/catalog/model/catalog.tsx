// The game's own cards, for every picker of the editor: their keys, names (in
// the editor's language, from the game's texts) and pictures (the API's
// catalog). Without the API the names and keys still come from the game's
// texts; without either, keys are typed by hand.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { game_api, type Catalog, type CatalogSprite } from '@/shared/api';
import { GAME_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import type { CardPicture } from '@/shared/ui';

/** the game's texts (its localization file): descriptions by set, and its dictionary */
export interface GameText {
  descriptions: Record<string, Record<string, { name?: string; text?: string[] }>>;
  misc: { dictionary: Record<string, string>; poker_hands?: Record<string, string>; labels?: Record<string, string>; suits_plural?: Record<string, string>; ranks?: Record<string, string> };
}

export type PickKind = 'jokers' | 'tarots' | 'planets' | 'spectrals' | 'vouchers' | 'decks' | 'blinds' | 'tags' | 'enhancements' | 'editions';

/** a card to choose in a picker */
export interface PickItem {
  key: string;
  name: string;
  group: string;
  picture?: CardPicture;
  /** a blind's chip row, or a tag's cell */
  chip?: { y: number; colour?: string };
  tag?: { x: number; y: number };
  hint?: string;
  rarity?: number;
  /** a consumable's set (Tarot, Planet, Spectral) */
  set?: string;
}

const SET_OF: Record<PickKind, string> = {
  jokers: 'Joker', tarots: 'Tarot', planets: 'Planet', spectrals: 'Spectral', vouchers: 'Voucher', decks: 'Back', blinds: 'Blind', tags: 'Tag',
  enhancements: 'Enhanced', editions: 'Edition',
};
const PREFIX_OF: Record<PickKind, string> = {
  jokers: 'j_', tarots: 'c_', planets: 'c_', spectrals: 'c_', vouchers: 'v_', decks: 'b_', blinds: 'bl_', tags: 'tag_', enhancements: 'm_', editions: 'e_',
};

export interface CatalogValue {
  catalog: Catalog | null;
  text: GameText | null;
  status: 'loading' | 'ready' | 'offline';
  /** every key the game has (null until known): the package's references are checked against it */
  keys: ReadonlySet<string> | null;
  name(key: string): string;
  picture(key: string): CardPicture | null;
  items(kind: PickKind): PickItem[];
  /** the game's words a message action can show (key, text) */
  messages: { key: string; text: string }[];
  /** a poker hand's name in the editor's language */
  hand_name(hand: string): string;
  /** a value's name in the editor's language (the game's words): m_gold, foil, Red (a seal), Hearts, Ace */
  term(kind: 'enhancement' | 'edition' | 'seal' | 'suit' | 'rank', value: string): string;
}

const CatalogContext = createContext<CatalogValue | null>(null);

const picture_of = (s: CatalogSprite | null | undefined): CardPicture | null => (s ? { atlas: s.atlas, x: s.pos.x, y: s.pos.y } : null);

let catalog_promise: Promise<Catalog> | null = null;
const text_promises = new Map<string, Promise<GameText>>();

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { game_lang } = useI18n();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [text, setText] = useState<GameText | null>(null);
  const [failed, setFailed] = useState({ catalog: false, text: false });

  useEffect(() => {
    let alive = true;
    catalog_promise = catalog_promise ?? game_api.catalog();
    catalog_promise.then((c) => { if (alive) setCatalog(c); }, () => {
      catalog_promise = null;
      if (alive) setFailed((f) => ({ ...f, catalog: true }));
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    let p = text_promises.get(game_lang);
    if (!p) {
      p = fetch(`${GAME_URL}/localization/${game_lang}.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<GameText>; });
      text_promises.set(game_lang, p);
    }
    p.then((x) => { if (alive) setText(x); }, () => {
      text_promises.delete(game_lang);
      if (alive) setFailed((f) => ({ ...f, text: true }));
    });
    return () => { alive = false; };
  }, [game_lang]);

  const value = useMemo<CatalogValue>(() => {
    const by_key = new Map<string, { set: string; name: string; sprite: CatalogSprite | null }>();
    if (catalog) {
      const add = (list: { key: string; name: string; set?: string; sprite: CatalogSprite | null }[], set?: string) => {
        for (const x of list) by_key.set(x.key, { set: set ?? x.set ?? '', name: x.name, sprite: x.sprite });
      };
      add(catalog.jokers); add(catalog.tarots); add(catalog.planets); add(catalog.spectrals); add(catalog.vouchers); add(catalog.decks);
      add([catalog.challenge_deck]); add(catalog.boosters); add(catalog.enhancements); add(catalog.editions);
      add(catalog.tags, 'Tag'); add(catalog.blinds, 'Blind');
    }
    const keys = catalog ? new Set<string>([...by_key.keys(), 'c_base', 'e_base']) : text ? keys_of_text(text) : null;
    const loc_name = (key: string): string | undefined => {
      if (!text) return undefined;
      for (const set of Object.values(text.descriptions)) if (set[key]?.name) return set[key].name;
      return undefined;
    };
    const name = (key: string) => loc_name(key) ?? by_key.get(key)?.name ?? key;
    const picture = (key: string) => picture_of(by_key.get(key)?.sprite);
    const items = (kind: PickKind): PickItem[] => {
      const group = kind;
      if (catalog) {
        switch (kind) {
          case 'blinds':
            return catalog.blinds.filter((b) => b.boss).map((b) => ({
              key: b.key, name: name(b.key), group, chip: b.sprite ? { y: b.sprite.pos.y, colour: b.colour ?? undefined } : undefined,
              hint: b.showdown ? 'showdown' : b.min_ante ? `ante ${b.min_ante}+` : undefined,
            }));
          case 'tags':
            return catalog.tags.map((x) => ({ key: x.key, name: name(x.key), group, tag: x.sprite ? { x: x.sprite.pos.x, y: x.sprite.pos.y } : undefined }));
          default: {
            const list = catalog[kind === 'decks' ? 'decks' : kind];
            return list.map((x) => ({ key: x.key, name: name(x.key), group, picture: picture_of(x.sprite) ?? undefined, rarity: x.rarity ?? undefined }));
          }
        }
      }
      if (!text) return [];
      const set = text.descriptions[SET_OF[kind]] ?? {};
      return Object.entries(set).filter(([k]) => k.startsWith(PREFIX_OF[kind])).map(([k, v]) => ({ key: k, name: v.name ?? k, group }));
    };
    const dict = text?.misc.dictionary ?? {};
    const messages = Object.entries(dict)
      .filter(([k]) => k.endsWith('_ex') || k.startsWith('k_plus_') || ['k_val_up', 'k_reset', 'ph_boss_disabled', 'ph_1_level', 'ph_mr_bones'].includes(k))
      .filter(([k]) => !['k_demo_version_ex', 'k_high_score_ex', 'k_unlocked_ex'].includes(k))
      .map(([key, v]) => ({ key, text: v }))
      .sort((a, b) => a.text.localeCompare(b.text));
    return {
      catalog,
      text,
      status: catalog || text ? 'ready' : failed.catalog && failed.text ? 'offline' : 'loading',
      keys,
      name,
      picture,
      items,
      messages,
      hand_name: (hand) => text?.misc.poker_hands?.[hand] ?? hand,
      term: (kind, value) => {
        if (kind === 'enhancement') return name(value);
        if (kind === 'edition') return loc_name(`e_${value}`) ?? value;
        if (kind === 'seal') return text?.misc.labels?.[`${value.toLowerCase()}_seal`] ?? `${value} Seal`;
        if (kind === 'suit') return text?.misc.suits_plural?.[value] ?? value;
        return text?.misc.ranks?.[value] ?? value;
      },
    };
  }, [catalog, text, failed]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

function keys_of_text(text: GameText): Set<string> {
  const out = new Set<string>(['c_base', 'e_base']);
  for (const set of Object.values(text.descriptions)) for (const k of Object.keys(set)) out.add(k);
  return out;
}

export function useCatalog(): CatalogValue {
  const v = useContext(CatalogContext);
  if (!v) throw new Error('useCatalog outside CatalogProvider');
  return v;
}
