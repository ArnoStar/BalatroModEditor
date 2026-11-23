// Starting points: a new mod (empty, or with a few items to take apart), a
// new item of each kind (blank, or a recipe: +Mult on a suit, a joker that
// grows, a Tarot that enhances …), and the refactorings an editor needs
// (renaming the mod's id or an item's key renames every reference to it).
import { is_object } from './py.ts';
import { full_key, KINDS, PREFIX, type ItemKind } from './spec.ts';
import type { AnyItem, ModPackage } from './types.ts';

function unique_key(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) if (!set.has(`${base}_${n}`)) return `${base}_${n}`;
}

const keys_of = (pkg: ModPackage, kind: ItemKind) => ((pkg[kind] ?? []) as { key?: string }[]).map((x) => String(x?.key ?? ''));

/** a new, empty item of a kind (a key not taken yet) */
export function blank_item(kind: ItemKind, pkg: ModPackage): AnyItem {
  switch (kind) {
    case 'jokers': return { key: unique_key('new_joker', keys_of(pkg, kind)), name: 'New Joker', rarity: 1, cost: 5, text: [], effects: [] };
    case 'consumables': return { key: unique_key('new_tarot', keys_of(pkg, kind)), name: 'New Tarot', set: 'Tarot', text: [], use: [] };
    case 'vouchers': return { key: unique_key('new_voucher', keys_of(pkg, kind)), name: 'New Voucher', cost: 10, text: [], redeem: [] };
    case 'decks': return { key: unique_key('new_deck', keys_of(pkg, kind)), name: 'New Deck', text: [] };
    case 'blinds': return { key: unique_key('new_blind', keys_of(pkg, kind)), name: 'The New', text: [], mult: 2, dollars: 5, min_ante: 1, colour: '#b44430' };
  }
}

export interface ItemTemplate { id: string; kind: ItemKind; make: () => AnyItem }

export const ITEM_TEMPLATES: ItemTemplate[] = [
  // ---- jokers
  { id: 'plus_mult', kind: 'jokers', make: () => ({
    key: 'lucky_charm', name: 'Lucky Charm', rarity: 1, cost: 4, config: { mult: 4 },
    text: ['{C:mult}+#1#{} Mult'], vars: ['self.mult'],
    effects: [{ on: 'score', do: [{ mult: 'self.mult' }] }],
  }) },
  { id: 'suit_mult', kind: 'jokers', make: () => ({
    key: 'heart_of_gold', name: 'Heart of Gold', rarity: 1, cost: 5, config: { mult: 3 },
    text: ['Played cards with {C:hearts}Heart{} suit', 'give {C:mult}+#1#{} Mult when scored'], vars: ['self.mult'],
    effects: [{ on: 'card_scored', if: "is_suit(card, 'Hearts')", do: [{ mult: 'self.mult' }] }],
  }) },
  { id: 'xmult_hand', kind: 'jokers', make: () => ({
    key: 'flush_fund', name: 'Flush Fund', rarity: 2, cost: 7, config: { xmult: 2 },
    text: ['{X:mult,C:white} X#1# {} Mult if played', 'hand contains a {C:attention}Flush{}'], vars: ['self.xmult'],
    effects: [{ on: 'score', if: "has_hand('Flush')", do: [{ xmult: 'self.xmult' }] }],
  }) },
  { id: 'scaling', kind: 'jokers', make: () => ({
    key: 'snowball', name: 'Snowball', rarity: 2, cost: 6, config: { xmult: 1, gain: 0.1 },
    text: ['This Joker gains {X:mult,C:white} X#2# {} Mult', 'for every hand played', '{C:inactive}(Currently {X:mult,C:white} X#1# {C:inactive} Mult)'],
    vars: ['self.xmult', 'self.gain'],
    effects: [
      { on: 'hand_finished', do: [{ set: { xmult: 'self.xmult + self.gain' } }, { message: 'k_upgrade_ex' }] },
      { on: 'score', if: 'self.xmult > 1', do: [{ xmult: 'self.xmult' }] },
    ],
  }) },
  { id: 'economy', kind: 'jokers', make: () => ({
    key: 'piggy_bank', name: 'Piggy Bank', rarity: 1, cost: 5, config: { money: 3 },
    text: ['Earn {C:money}$#1#{} at', 'end of round'], vars: ['self.money'],
    effects: [{ on: 'cash_out', do: [{ dollars: 'self.money' }] }],
  }) },
  { id: 'retrigger', kind: 'jokers', make: () => ({
    key: 'echo', name: 'Echo', rarity: 2, cost: 6, config: { times: 1 },
    text: ['Retrigger each played', '{C:attention}face{} card'],
    effects: [{ on: 'retrigger_scored', if: 'card.face', do: [{ retrigger: 'self.times' }] }],
  }) },
  { id: 'chance', kind: 'jokers', make: () => ({
    key: 'gambler', name: 'Gambler', rarity: 1, cost: 5, config: { odds: 4, money: 2 },
    text: ['{C:green}#1# in #2#{} chance for each', 'scored card to earn {C:money}$#3#{}'], vars: ['game.probability', 'self.odds', 'self.money'],
    effects: [{ on: 'card_scored', if: 'chance(1, self.odds)', do: [{ dollars: 'self.money' }] }],
  }) },
  { id: 'creator', kind: 'jokers', make: () => ({
    key: 'fortune_teller', name: 'Fortune Teller', rarity: 2, cost: 6,
    text: ['Create a {C:tarot}Tarot{} card', 'when {C:attention}Blind{} is selected', '{C:inactive}(Must have room)'],
    effects: [{ on: 'blind_selected', do: [{ create: { set: 'Tarot' } }, { message: 'k_plus_tarot' }] }],
  }) },
  { id: 'passive', kind: 'jokers', make: () => ({
    key: 'big_pockets', name: 'Big Pockets', rarity: 2, cost: 6,
    text: ['{C:attention}+#1#{} hand size'], vars: [1], passive: { hand_size: 1 }, effects: [],
  }) },
  { id: 'destroyer', kind: 'jokers', make: () => ({
    key: 'shredder', name: 'Shredder', rarity: 2, cost: 6, config: { chips: 0, gain: 10 },
    text: ['Destroys scored {C:attention}2s{}, gains', '{C:chips}+#2#{} Chips for each', '{C:inactive}(Currently {C:chips}+#1#{C:inactive} Chips)'],
    vars: ['self.chips', 'self.gain'],
    effects: [
      { on: 'card_destroy', if: 'card.rank == 2' },
      { on: 'card_scored', if: 'card.rank == 2', do: [{ set: { chips: 'self.chips + self.gain' } }] },
      { on: 'score', if: 'self.chips > 0', do: [{ chips: 'self.chips' }] },
    ],
  }) },
  // ---- consumables
  { id: 'tarot_enhance', kind: 'consumables', make: () => ({
    key: 'the_smith', name: 'The Smith', set: 'Tarot', targets: { min: 1, max: 2 },
    text: ['Enhances {C:attention}#1#{} selected', 'cards into', '{C:attention,T:m_steel}Steel Cards{}'], vars: [2],
    use: [{ modify: { enhancement: 'm_steel' } }],
  }) },
  { id: 'tarot_money', kind: 'consumables', make: () => ({
    key: 'the_merchant', name: 'The Merchant', set: 'Tarot', config: { per: 2, max: 20 },
    text: ['Earn {C:money}$#1#{} per Joker', '{C:inactive}(Max of {C:money}$#2#{C:inactive})'], vars: ['self.per', 'self.max'],
    use: [{ dollars: 'min(self.max, self.per * game.joker_count)' }],
  }) },
  { id: 'planet', kind: 'consumables', make: () => ({ key: 'nibiru', name: 'Nibiru', set: 'Planet', hand: 'Straight Flush' }) },
  { id: 'spectral', kind: 'consumables', make: () => ({
    key: 'the_forge', name: 'The Forge', set: 'Spectral', targets: { min: 1, max: 1 },
    text: ['Add {C:dark_edition}Polychrome{} to', '{C:attention}1{} selected card,', '{C:red}-$#1#{}'], vars: [5],
    use: [{ modify: { edition: 'polychrome' } }, { dollars: -5 }],
  }) },
  // ---- vouchers
  { id: 'voucher_slot', kind: 'vouchers', make: () => ({
    key: 'deep_pockets', name: 'Deep Pockets', text: ['{C:attention}+1{} consumable slot'], redeem: [{ modify_run: { consumable_slots: 1 } }],
  }) },
  { id: 'voucher_hand', kind: 'vouchers', make: () => ({
    key: 'second_wind', name: 'Second Wind', text: ['{C:blue}+1{} hand', 'every round'], redeem: [{ modify_run: { hands: 1 } }],
  }) },
  // ---- decks
  { id: 'deck_money', kind: 'decks', make: () => ({
    key: 'rich', name: 'Rich Deck', sprite: { atlas: 'centers', x: 3, y: 2 }, text: ['Start with {C:money}$#1#{} extra'], vars: [10],
    start: { dollars: 10 },
  }) },
  { id: 'deck_royal', kind: 'decks', make: () => ({
    key: 'royal', name: 'Royal Deck', sprite: { atlas: 'centers', x: 5, y: 2 },
    text: ['Only {C:attention}10s{}, {C:attention}face cards{}', 'and {C:attention}Aces{}'],
    cards: { ranks: ['10', 'Jack', 'Queen', 'King', 'Ace'] },
  }) },
  { id: 'deck_joker', kind: 'decks', make: () => ({
    key: 'jesters', name: 'Jester’s Deck', sprite: { atlas: 'centers', x: 0, y: 2 },
    text: ['Start with a', '{C:attention,T:j_joker}Joker{}'], jokers: ['j_joker'],
  }) },
  // ---- blinds
  { id: 'blind_suit', kind: 'blinds', make: () => ({
    key: 'thorn', name: 'The Thorn', min_ante: 1, colour: '#3e5a73', sprite: { blind: 'bl_goad' },
    text: ['All Spade cards', 'are debuffed'], debuff_card: "is_suit(card, 'Spades')",
  }) },
  { id: 'blind_five', kind: 'blinds', make: () => ({
    key: 'crowd', name: 'The Crowd', min_ante: 2, colour: '#7a4fa8', sprite: { blind: 'bl_psychic' },
    text: ['Must play 5 cards'], debuff_hand: 'hand.count < 5',
  }) },
  { id: 'blind_tax', kind: 'blinds', make: () => ({
    key: 'tax', name: 'The Tax', min_ante: 1, colour: '#b58a2a', sprite: { blind: 'bl_tooth' },
    text: ['Lose {C:money}$2{} per', 'hand played'], on_hand: [{ dollars: -2 }],
  }) },
  { id: 'blind_drought', kind: 'blinds', make: () => ({
    key: 'drought', name: 'The Drought', min_ante: 2, colour: '#c08a3e', sprite: { blind: 'bl_water' },
    text: ['-2 discards'], on_set: [{ discards: -2 }],
  }) },
];

/** an item made from a template, its key not taken yet in the package */
export function from_template(tpl: ItemTemplate, pkg: ModPackage): AnyItem {
  const it = tpl.make();
  return { ...it, key: unique_key(it.key, keys_of(pkg, tpl.kind)) } as AnyItem;
}

export type ModTemplateId = 'blank' | 'jokers' | 'everything' | 'rules' | 'creative';

export function mod_template(id: ModTemplateId, name: string, mod_id: string, author = ''): ModPackage {
  const pkg: ModPackage = { format: 1, id: mod_id, name, version: '1.0.0', author, description: '', tags: [], assets: {} };
  const tpl = (k: string) => ITEM_TEMPLATES.find((x) => x.id === k)!.make();
  switch (id) {
    case 'blank': return pkg;
    case 'jokers': return { ...pkg, tags: ['jokers'], jokers: [tpl('suit_mult'), tpl('scaling'), tpl('economy')] as ModPackage['jokers'] };
    case 'everything': return {
      ...pkg, tags: ['jokers', 'consumables', 'vouchers', 'decks', 'blinds'],
      jokers: [tpl('plus_mult')] as ModPackage['jokers'],
      consumables: [tpl('tarot_enhance'), tpl('planet'), tpl('spectral')] as ModPackage['consumables'],
      vouchers: [tpl('voucher_slot')] as ModPackage['vouchers'],
      decks: [tpl('deck_money')] as ModPackage['decks'],
      blinds: [tpl('blind_suit')] as ModPackage['blinds'],
    };
    case 'rules': return { ...pkg, tags: ['rules'], rules: { hands: 1, hand_size: 1, reroll_cost: -2 } };
    case 'creative': return { ...pkg, tags: ['creative'], creative: true };
  }
}

// ------------------------------------------------------------------ refactoring
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** every string of the package (but its images) with `map` applied */
function map_strings<T>(x: T, map: (s: string) => string, top = true): T {
  if (typeof x === 'string') return map(x) as T;
  if (Array.isArray(x)) {
    let changed = false;
    const out = x.map((v) => { const n = map_strings(v, map, false); if (n !== v) changed = true; return n; });
    return (changed ? out : x) as T;
  }
  if (is_object(x)) {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) {
      const n = top && k === 'assets' ? v : map_strings(v, map, false);
      if (n !== v) changed = true;
      out[k] = n;
    }
    return (changed ? out : x) as T;
  }
  return x;
}

/** the package with one game key replaced by another wherever it is named (a whole key only) */
export function replace_key(pkg: ModPackage, from: string, to: string): ModPackage {
  if (from === to) return pkg;
  const re = new RegExp(`(?<![A-Za-z0-9_])${esc(from)}(?![A-Za-z0-9_])`, 'g');
  return map_strings(pkg, (s) => (s.includes(from) ? s.replace(re, to) : s));
}

/** the package with its id changed, and its own items' keys renamed wherever it names them */
export function rename_mod_id(pkg: ModPackage, to: string): ModPackage {
  const from = pkg.id;
  let out: ModPackage = { ...pkg, id: to };
  if (!from || from === to) return out;
  for (const kind of KINDS) {
    for (const it of (pkg[kind] ?? []) as { key?: unknown }[]) {
      if (typeof it?.key === 'string') out = replace_key(out, full_key(from, kind, it.key), full_key(to, kind, it.key));
    }
  }
  return out;
}

/** the package with an item's key changed, and every reference to it */
export function rename_item_key(pkg: ModPackage, kind: ItemKind, index: number, to: string): ModPackage {
  const list = (pkg[kind] ?? []) as AnyItem[];
  const it = list[index];
  if (!it) return pkg;
  const from = it.key;
  const renamed = list.slice();
  renamed[index] = { ...it, key: to };
  const out = { ...pkg, [kind]: renamed } as ModPackage;
  if (!from || !re_key.test(from) || !re_key.test(to)) return out;
  return replace_key(out, `${PREFIX[kind]}_${pkg.id}_${from}`, `${PREFIX[kind]}_${pkg.id}_${to}`);
}
const re_key = /^[a-z][a-z0-9_]*$/;

/** the package with an image renamed, and the items that show it */
export function rename_asset(pkg: ModPackage, from: string, to: string): ModPackage {
  const assets = { ...(pkg.assets ?? {}) };
  if (!(from in assets) || to in assets) return pkg;
  const entries = Object.entries(assets).map(([k, v]) => [k === from ? to : k, v] as const);
  const out: ModPackage = { ...pkg, assets: Object.fromEntries(entries) };
  for (const kind of KINDS) {
    const list = out[kind] as AnyItem[] | undefined;
    if (list?.some((x) => x?.sprite === from)) (out as unknown as Record<string, unknown>)[kind] = list.map((x) => (x?.sprite === from ? { ...x, sprite: to } : x));
  }
  return out;
}
