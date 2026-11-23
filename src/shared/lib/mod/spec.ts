// The format of content mods (format 1): the twin of BalatroEngine's
// balatro/mods/spec.py (keep both in step; `npm run parity` compares them on
// thousands of packages). `validate` lists what is wrong with a package, each
// problem with its place in it, in the engine's order and words; `scope_for`
// says what an expression may name where it is written (the editor's
// completions come from it too).
import { check, ExprError, make_scope, parse, type Node, type Scope } from './expr.ts';
import type { Issue, Msg } from './issues.ts';
import { is_object, py_dumps, py_eq, py_len, utf8_size } from './py.ts';

export const FORMAT = 1;
export const ID_PATTERN = '^[a-z][a-z0-9_]{2,31}$';
export const KEY_PATTERN = '^[a-z][a-z0-9_]{0,31}$';
export const VERSION_PATTERN = '^(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})$';
export const ASSET_NAME = '^[a-z0-9_][a-z0-9_.-]{0,47}$';
export const LANG_PATTERN = '^[a-z]{2}(_[A-Za-z0-9]{2,3})?(-[a-z]{2})?$';
export const COLOUR = '^#[0-9a-fA-F]{6}$';
const TAG_PATTERN = '^[a-z0-9][a-z0-9 -]*$';
const BLIND_SPRITE = '^bl_[a-z_]+$';
const CREATE_KEY = '^[a-z]+_[a-z0-9_]+$';
const TAG_KEY = '^tag_[a-z_]+$';
const VOUCHER_KEY = '^v_[a-z0-9_]+$';

const RE = new Map<string, RegExp>();
// (Python's `$` also matches before a newline that ends the text: the same here)
const re = (p: string) => {
  let r = RE.get(p);
  if (!r) { r = new RegExp(p.endsWith('$') ? p.slice(0, -1) + '\\n?$' : p); RE.set(p, r); }
  return r;
};

export const MAX_PACKAGE_BYTES = 1_500_000;
export const MAX_ASSET_BYTES = 256_000;
export const MAX_ASSETS = 64;
export const MAX_ITEMS = 100;
export const MAX_EFFECTS = 32;
export const MAX_ACTIONS = 16;
export const MAX_CONFIG = 32;
export const MAX_TEXT_LINES = 8;
export const MAX_LINE = 160;

export const RANKS: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': 'T',
  Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A',
};
export const RANK_NAMES = Object.keys(RANKS);
export const RANK_IDS: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, Jack: 11, Queen: 12, King: 13, Ace: 14,
};
export const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'] as const;
export const SEALS = ['Gold', 'Red', 'Blue', 'Purple'] as const;
export const EDITIONS = ['foil', 'holo', 'polychrome', 'negative'] as const;
export const ENHANCEMENTS = ['m_bonus', 'm_mult', 'm_wild', 'm_glass', 'm_steel', 'm_stone', 'm_gold', 'm_lucky'] as const;
export const POKER_HANDS = ['Flush Five', 'Flush House', 'Five of a Kind', 'Straight Flush', 'Four of a Kind', 'Full House',
  'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'Pair', 'High Card'] as const;
export const CONSUMABLE_SETS = ['Tarot', 'Planet', 'Spectral'] as const;
/** the game's sheets an item may take its picture from: [cells across, cells down] */
export const ATLASES: Record<string, [number, number]> = {
  Joker: [10, 16], Tarot: [10, 6], Voucher: [9, 4], centers: [7, 5], Planet: [10, 6], Spectral: [10, 6],
};

// The run modifiers: one vocabulary for a mod's rules, a deck's start, a
// joker's passive changes and the modify_run action.
export const RUN_MODIFIERS = ['dollars', 'hands', 'discards', 'hand_size', 'joker_slots', 'consumable_slots', 'interest_cap',
  'reroll_cost', 'shop_slots', 'discount_percent', 'probability_mult', 'win_ante', 'blind_scale'] as const;
export const START_ONLY = ['win_ante', 'blind_scale'];
export const NOT_PASSIVE = ['dollars', 'win_ante', 'blind_scale', 'shop_slots', 'reroll_cost', 'discount_percent'];
export type ModifierContext = 'start' | 'passive' | 'action';

// ---------------------------------------------------------------- scopes
export const CARD_FIELDS = ['rank', 'rank_name', 'suit', 'face', 'chips', 'enhancement', 'seal', 'edition', 'debuffed', 'key',
  'set', 'rarity', 'sell_value', 'cost'] as const;
export const GAME_FIELDS = ['money', 'ante', 'round', 'hands_left', 'discards_left', 'hands_played', 'discards_used', 'hand_size',
  'deck_count', 'full_deck_count', 'joker_count', 'joker_slots', 'consumable_count',
  'consumable_slots', 'probability', 'blind_boss', 'blind_chips', 'round_chips', 'skips', 'rerolls',
  'interest_cap', 'stake', 'hands_per_round', 'discards_per_round'] as const;
export const HAND_FIELDS = ['name', 'level', 'played', 'played_this_round', 'count', 'scoring_count', 'chips', 'mult'] as const;
export const JOKER_FIELDS = ['position', 'sell_value', 'edition'] as const;
export const BLIND_FIELDS = ['boss', 'key', 'chips', 'mult', 'dollars'] as const;
export const EVENT_FIELDS = ['count', 'faces', 'glass'] as const;
export const CARD_LISTS = ['jokers', 'consumables', 'full_deck', 'deck', 'held'] as const;
export const HAND_LISTS = ['scoring', 'played'] as const;

export const GAME_FUNCTIONS: Record<string, [number, number]> = {
  is_suit: [2, 2], is_rank: [2, 2], is_face: [1, 1], count: [1, 1], count_suit: [2, 2],
  count_rank: [2, 2], count_face: [1, 1], count_enhancement: [2, 2], count_seal: [2, 2],
  count_edition: [2, 2], count_key: [2, 2], hand_level: [1, 1], times_played: [1, 1],
  has_joker: [1, 1], has_voucher: [1, 1],
};
export const HAND_FUNCTIONS: Record<string, [number, number]> = { has_hand: [1, 1] };
export const RANDOM_FUNCTIONS: Record<string, [number, number]> = { chance: [2, 3], random: [2, 3] };

// ---------------------------------------------------------------- triggers
export const HAND_TRIGGERS = ['hand_played', 'card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'score',
  'other_joker', 'hand_finished', 'card_destroy', 'hand_not_allowed'];
export const CARD_TRIGGERS = ['card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'discard', 'card_destroy'];
export const OTHER_TRIGGERS = ['other_joker', 'card_bought', 'card_sold', 'consumable_used'];
export const JOKER_TRIGGERS = [
  'hand_played', 'card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'score', 'other_joker',
  'hand_finished', 'discard', 'discard_start', 'round_end', 'cash_out', 'card_destroy', 'blind_selected',
  'first_hand_drawn', 'shop_reroll', 'shop_exit', 'blind_skipped', 'pack_opened', 'pack_skipped', 'card_bought',
  'card_sold', 'sold', 'consumable_used', 'cards_added', 'cards_destroyed', 'hand_not_allowed',
] as const;
export type Trigger = (typeof JOKER_TRIGGERS)[number];
export const SCORING_ACTIONS: Record<string, string[]> = {
  card_scored: ['chips', 'mult', 'xmult'],
  card_held: ['mult', 'xmult'],
  score: ['chips', 'mult', 'xmult'],
  other_joker: ['chips', 'mult', 'xmult'],
};
export const ACTIONS = ['chips', 'mult', 'xmult', 'dollars', 'retrigger', 'set', 'message', 'level_up', 'create', 'destroy_self',
  'destroy_card', 'hands', 'discards', 'modify_run', 'modify', 'add_tag', 'disable_boss'] as const;
export type ActionName = (typeof ACTIONS)[number];
export const MODIFY_FIELDS = ['target', 'where', 'enhancement', 'seal', 'edition', 'suit', 'rank', 'chips', 'destroy'];
export const TARGETS = ['card', 'scoring', 'played', 'held', 'selected'] as const;
export const BLIND_ACTIONS: Record<'on_set' | 'on_hand', string[]> = {
  on_set: ['hands', 'discards', 'hand_size', 'dollars', 'message'],
  on_hand: ['dollars', 'message'],
};

/** where an expression is: an item's kind, or a blind's card/hand test, or a modify action's `where` */
export type ScopeKind = 'joker' | 'consumable' | 'voucher' | 'deck' | 'blind' | 'blind_card' | 'blind_hand' | 'modify';

/** The names an expression may use in this place of a package. */
export function scope_for(kind: ScopeKind, trigger: string | null, config: Record<string, unknown> | null,
  allow_impure = true): Scope {
  const roots: Record<string, readonly string[] | null> = { game: GAME_FIELDS, self: Object.keys(config ?? {}) };
  for (const k of CARD_LISTS) roots[k] = [];
  const functions: Record<string, [number, number]> = { ...GAME_FUNCTIONS };
  if (kind === 'joker') roots.joker = JOKER_FIELDS;
  if ((trigger !== null && HAND_TRIGGERS.includes(trigger)) || kind === 'blind_hand') {
    roots.hand = HAND_FIELDS;
    for (const k of HAND_LISTS) roots[k] = [];
    Object.assign(functions, HAND_FUNCTIONS);
  }
  if ((trigger !== null && CARD_TRIGGERS.includes(trigger)) || kind === 'blind_card' || kind === 'modify') roots.card = CARD_FIELDS;
  if (trigger !== null && OTHER_TRIGGERS.includes(trigger)) roots.other = CARD_FIELDS;
  if (trigger === 'discard' || trigger === 'discard_start') roots.discarded = [];
  if (trigger === 'blind_selected') roots.blind = BLIND_FIELDS;
  if (trigger === 'cards_added' || trigger === 'cards_destroyed') roots.event = EVENT_FIELDS;
  if (kind === 'consumable') roots.selected = [];
  Object.assign(functions, RANDOM_FUNCTIONS);
  // (list roots have no fields: they are only passed to functions)
  return make_scope(roots, functions, Object.keys(RANDOM_FUNCTIONS), allow_impure, ['card', 'other']);
}

// ---------------------------------------------------------------- validation
const MAX_ERRORS = 200;

class V {
  issues: Issue[] = [];

  err(path: string, msg: Msg) {
    if (this.issues.length < MAX_ERRORS) this.issues.push({ path, msg, level: 'error' });
  }

  obj(path: string, v: unknown, allowed?: readonly string[]): v is Record<string, unknown> {
    if (!is_object(v)) { this.err(path, { k: 'object' }); return false; }
    if (allowed) for (const k of Object.keys(v)) if (!allowed.includes(k)) this.err(path, { k: 'unknown_field', field: k });
    return true;
  }

  string(path: string, v: unknown, lo = 0, hi = 200, pattern?: string): v is string {
    if (typeof v !== 'string') { this.err(path, { k: 'string' }); return false; }
    const n = py_len(v);
    if (!(lo <= n && n <= hi)) { this.err(path, { k: 'length', lo, hi }); return false; }
    if (pattern !== undefined && !re(pattern).test(v)) { this.err(path, { k: 'pattern', value: v, pattern }); return false; }
    return true;
  }

  number(path: string, v: unknown, lo?: number, hi?: number, integer = false): v is number {
    if (typeof v !== 'number' || !Number.isFinite(v)) { this.err(path, { k: 'number' }); return false; }
    if (integer && !Number.isInteger(v)) { this.err(path, { k: 'whole' }); return false; }
    if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) { this.err(path, { k: 'between', lo: lo!, hi: hi! }); return false; }
    return true;
  }

  boolean(path: string, v: unknown): v is boolean {
    if (typeof v !== 'boolean') { this.err(path, { k: 'boolean' }); return false; }
    return true;
  }

  one_of(path: string, v: unknown, options: readonly string[]): boolean {
    if (!options.some((o) => py_eq(v, o))) { this.err(path, { k: 'one_of', options: [...options] }); return false; }
    return true;
  }

  array(path: string, v: unknown, hi: number): v is unknown[] {
    if (!Array.isArray(v)) { this.err(path, { k: 'list' }); return false; }
    if (v.length > hi) { this.err(path, { k: 'at_most', n: hi }); return false; }
    return true;
  }

  expression(path: string, v: unknown, scope: Scope): Node | null {
    if (typeof v === 'boolean' || typeof v === 'number') return ['const', v as boolean];
    if (typeof v !== 'string') { this.err(path, { k: 'expression_type' }); return null; }
    let node: Node;
    try {
      node = parse(v);
    } catch (e) {
      if (e instanceof ExprError) { this.err(path, e.msg); return null; }
      throw e;
    }
    for (const m of check(node, scope)) this.err(path, m);
    return node;
  }
}

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const get = (o: Record<string, unknown>, k: string, d?: unknown) => (has(o, k) ? o[k] : d);
const in_list = (v: unknown, xs: readonly unknown[]) => xs.some((x) => py_eq(v, x));

function text(v: V, path: string, item: Record<string, unknown>) {
  v.string(`${path}.name`, get(item, 'name', null), 1, 40);
  const lines = get(item, 'text', []);
  if (v.array(`${path}.text`, lines, MAX_TEXT_LINES)) lines.forEach((line, i) => v.string(`${path}.text[${i}]`, line, 0, MAX_LINE));
  const loc = get(item, 'loc', {});
  if (v.obj(`${path}.loc`, loc)) {
    for (const [lang, t] of Object.entries(loc)) {
      const p = `${path}.loc.${lang}`;
      if (!re(LANG_PATTERN).test(lang)) v.err(p, { k: 'language_code' });
      if (v.obj(p, t, ['name', 'text'])) {
        if (has(t, 'name')) v.string(`${p}.name`, t.name, 1, 40);
        if (has(t, 'text') && v.array(`${p}.text`, t.text, MAX_TEXT_LINES)) t.text.forEach((line, i) => v.string(`${p}.text[${i}]`, line, 0, MAX_LINE));
      }
    }
  }
}

function sprite(v: V, path: string, s: unknown, assets: Record<string, unknown> | null, kind: string) {
  if (s === null || s === undefined) return;
  if (typeof s === 'string') {
    // (a package without its images, `logic`, names them all the same: the engine doesn't draw)
    if (assets !== null && !has(assets, s)) v.err(path, { k: 'no_asset', name: s });
    else if (!re(ASSET_NAME).test(s)) v.err(path, { k: 'asset_name' });
    return;
  }
  if (kind === 'blind') {
    if (v.obj(path, s, ['blind'])) v.string(`${path}.blind`, get(s, 'blind', null), 1, 40, BLIND_SPRITE);
    return;
  }
  if (v.obj(path, s, ['atlas', 'x', 'y'])) {
    const atlas = get(s, 'atlas', null);
    if (v.one_of(`${path}.atlas`, atlas, Object.keys(ATLASES))) {
      const [w, h] = ATLASES[atlas as string];
      v.number(`${path}.x`, get(s, 'x', null), 0, w - 1, true);
      v.number(`${path}.y`, get(s, 'y', null), 0, h - 1, true);
    }
  }
}

function config_of(v: V, path: string, cfg: unknown): Record<string, unknown> {
  if (cfg === null || cfg === undefined) return {};
  if (!v.obj(path, cfg)) return {};
  if (Object.keys(cfg).length > MAX_CONFIG) v.err(path, { k: 'too_many_values', n: MAX_CONFIG });
  for (const [k, val] of Object.entries(cfg)) {
    if (!re(KEY_PATTERN).test(k)) v.err(`${path}.${k}`, { k: 'value_name' });
    if (!(typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean')) v.err(`${path}.${k}`, { k: 'value_type' });
    else if (typeof val === 'string' && py_len(val) > 60) v.err(`${path}.${k}`, { k: 'value_long' });
  }
  return { ...cfg };
}

function modifiers(v: V, path: string, mods: unknown, context: ModifierContext, scope: Scope | null = null) {
  if (!v.obj(path, mods)) return;
  for (const [k, val] of Object.entries(mods)) {
    const p = `${path}.${k}`;
    if (!(RUN_MODIFIERS as readonly string[]).includes(k)) { v.err(p, { k: 'unknown_modifier', options: [...RUN_MODIFIERS] }); continue; }
    if ((context === 'passive' || context === 'action') && START_ONLY.includes(k)) v.err(p, { k: 'start_only' });
    if (context === 'passive' && NOT_PASSIVE.includes(k)) v.err(p, { k: 'not_passive' });
    if (scope !== null && typeof val === 'string') v.expression(p, val, scope);
    else if (k === 'probability_mult' || k === 'blind_scale') v.number(p, val, 0.01, 1000);
    else v.number(p, val, -1000, 1000);
  }
}

function actions(v: V, path: string, acts: unknown, kind: ScopeKind, trigger: string | null, config: Record<string, unknown>, scope: Scope) {
  if (!v.array(path, acts, MAX_ACTIONS)) return;
  const scoring = SCORING_ACTIONS[trigger ?? ''] ?? [];
  acts.forEach((a, i) => {
    let p = `${path}[${i}]`;
    if (!v.obj(p, a)) return;
    const entries = Object.entries(a);
    if (entries.length !== 1) { v.err(p, { k: 'one_field_action' }); return; }
    const [name, arg] = entries[0];
    p = `${p}.${name}`;
    if (!(ACTIONS as readonly string[]).includes(name)) { v.err(p, { k: 'unknown_action', options: [...ACTIONS] }); return; }
    switch (name) {
      case 'chips': case 'mult': case 'xmult':
        if (!scoring.includes(name)) v.err(p, { k: 'only_scores_in', triggers: Object.entries(SCORING_ACTIONS).filter(([, s]) => s.includes(name)).map(([t]) => t) });
        v.expression(p, arg, scope);
        break;
      case 'retrigger':
        if (trigger !== 'retrigger_scored' && trigger !== 'retrigger_held') v.err(p, { k: 'only_retrigger' });
        v.expression(p, arg, scope);
        break;
      case 'dollars': case 'hands': case 'discards':
        v.expression(p, arg, scope);
        break;
      case 'set':
        if (kind !== 'joker') v.err(p, { k: 'only_joker_values' });
        if (v.obj(p, arg)) {
          for (const [k, e] of Object.entries(arg)) {
            if (!has(config, k)) v.err(`${p}.${k}`, { k: 'not_config_value' });
            v.expression(`${p}.${k}`, e, scope);
          }
        }
        break;
      case 'message':
        v.string(p, arg, 1, 40);
        break;
      case 'level_up':
        if (typeof arg === 'number' || typeof arg === 'string') {
          v.expression(p, arg, scope);
          if (!['hand_played', 'score', 'hand_finished'].includes(trigger ?? '') && kind !== 'consumable') v.err(p, { k: 'level_up_played' });
        } else if (v.obj(p, arg, ['hand', 'levels'])) {
          if (has(arg, 'hand')) v.expression(`${p}.hand`, arg.hand, scope);
          else if (!['hand_played', 'score', 'hand_finished'].includes(trigger ?? '')) v.err(`${p}.hand`, { k: 'hand_needed' });
          if (has(arg, 'levels')) v.expression(`${p}.levels`, arg.levels, scope);
        }
        break;
      case 'create':
        if (v.obj(p, arg, ['set', 'key', 'rarity', 'edition'])) {
          v.one_of(`${p}.set`, get(arg, 'set', null), [...CONSUMABLE_SETS, 'Joker']);
          if (has(arg, 'key')) v.string(`${p}.key`, arg.key, 3, 64, CREATE_KEY);
          if (has(arg, 'rarity')) {
            if (!py_eq(get(arg, 'set', null), 'Joker')) v.err(`${p}.rarity`, { k: 'only_jokers' });
            v.number(`${p}.rarity`, arg.rarity, 1, 4, true);
          }
          if (has(arg, 'edition')) v.one_of(`${p}.edition`, arg.edition, EDITIONS);
        }
        break;
      case 'destroy_self': case 'disable_boss':
        v.boolean(p, arg);
        if (name === 'destroy_self' && kind !== 'joker') v.err(p, { k: 'only_joker_destroys' });
        break;
      case 'destroy_card':
        v.boolean(p, arg);
        if (trigger !== 'discard') v.err(p, { k: 'only_discard' });
        break;
      case 'modify_run':
        modifiers(v, p, arg, 'action', scope);
        break;
      case 'modify':
        modify(v, p, arg, kind, trigger, config);
        break;
      case 'add_tag':
        v.string(p, arg, 5, 40, TAG_KEY);
        break;
    }
  });
}

function modify(v: V, p: string, arg: unknown, kind: ScopeKind, trigger: string | null, config: Record<string, unknown>) {
  if (!v.obj(p, arg, MODIFY_FIELDS)) return;
  const target = get(arg, 'target', kind === 'consumable' ? 'selected' : 'card');
  if (v.one_of(`${p}.target`, target, TARGETS)) {
    if (py_eq(target, 'card') && !CARD_TRIGGERS.includes(trigger ?? '')) v.err(`${p}.target`, { k: 'no_card_here' });
    if (in_list(target, HAND_LISTS) && !HAND_TRIGGERS.includes(trigger ?? '')) v.err(`${p}.target`, { k: 'no_played_hand' });
    if (py_eq(target, 'selected') && kind !== 'consumable') v.err(`${p}.target`, { k: 'only_consumable_selected' });
  }
  if (has(arg, 'where')) v.expression(`${p}.where`, arg.where, scope_for('modify', trigger, config));
  if (has(arg, 'enhancement')) v.one_of(`${p}.enhancement`, arg.enhancement, [...ENHANCEMENTS, 'none']);
  if (has(arg, 'seal')) v.one_of(`${p}.seal`, arg.seal, [...SEALS, 'none']);
  if (has(arg, 'edition')) v.one_of(`${p}.edition`, arg.edition, ['foil', 'holo', 'polychrome', 'none']);
  if (has(arg, 'suit')) v.one_of(`${p}.suit`, arg.suit, SUITS);
  if (has(arg, 'rank')) v.one_of(`${p}.rank`, arg.rank, [...RANK_NAMES, 'up', 'down']);
  if (has(arg, 'chips')) v.expression(`${p}.chips`, arg.chips, scope_for('modify', trigger, config));
  if (has(arg, 'destroy')) {
    v.boolean(`${p}.destroy`, arg.destroy);
    if (!py_eq(target, 'selected')) v.err(`${p}.destroy`, { k: 'destroy_selected_only' });
  }
  if (!['enhancement', 'seal', 'edition', 'suit', 'rank', 'chips', 'destroy'].some((k) => has(arg, k))) v.err(p, { k: 'changes_nothing' });
}

function effects(v: V, path: string, effs: unknown, kind: ScopeKind, triggers: readonly string[], config: Record<string, unknown>) {
  if (!v.array(path, effs, MAX_EFFECTS)) return;
  effs.forEach((eff, i) => {
    const p = `${path}[${i}]`;
    if (!v.obj(p, eff, ['on', 'if', 'do', 'else'])) return;
    const trigger = get(eff, 'on', null);
    if (!v.one_of(`${p}.on`, trigger, triggers)) return;
    const t = String(trigger);
    const scope = scope_for(kind, t, config);
    if (has(eff, 'if')) v.expression(`${p}.if`, eff.if, scope);
    if (!has(eff, 'do')) {
      if (t !== 'card_destroy') v.err(`${p}.do`, { k: 'do_missing' });
    } else {
      actions(v, `${p}.do`, eff.do, kind, t, config, scope);
    }
    if (has(eff, 'else')) {
      if (!has(eff, 'if')) v.err(`${p}.else`, { k: 'else_needs_if' });
      actions(v, `${p}.else`, eff.else, kind, t, config, scope);
    }
  });
}

function items(v: V, pkg: Record<string, unknown>, name: string): Record<string, unknown>[] {
  const list = get(pkg, name, []);
  if (!v.array(name, list, MAX_ITEMS)) return [];
  const seen = new Set<string>();
  list.forEach((it, i) => {
    if (is_object(it)) {
      const k = get(it, 'key', null);
      if (v.string(`${name}[${i}].key`, k, 1, 32, KEY_PATTERN)) {
        if (seen.has(k)) v.err(`${name}[${i}].key`, { k: 'key_twice', key: k });
        seen.add(k);
      }
    }
  });
  return list.filter(is_object);
}

export const ITEM_FIELDS = ['key', 'name', 'text', 'vars', 'loc', 'sprite'];
export const PACKAGE_FIELDS = ['format', 'id', 'name', 'version', 'author', 'description', 'tags', 'loc', 'rules',
  'creative', 'jokers', 'consumables', 'vouchers', 'decks', 'blinds', 'assets'];
export const JOKER_ITEM_FIELDS = [...ITEM_FIELDS, 'rarity', 'cost', 'config', 'blueprint_compat', 'eternal_compat',
  'perishable_compat', 'passive', 'effects', 'in_shop'];
export const CONSUMABLE_ITEM_FIELDS = [...ITEM_FIELDS, 'set', 'cost', 'config', 'hand', 'targets', 'can_use', 'use'];
export const VOUCHER_ITEM_FIELDS = [...ITEM_FIELDS, 'cost', 'config', 'requires', 'redeem'];
export const DECK_ITEM_FIELDS = [...ITEM_FIELDS, 'start', 'jokers', 'consumables', 'vouchers', 'cards'];
export const BLIND_ITEM_FIELDS = [...ITEM_FIELDS, 'mult', 'dollars', 'min_ante', 'max_ante', 'showdown', 'colour', 'debuff_card',
  'debuff_hand', 'on_set', 'on_hand'];

function vars(v: V, path: string, item: Record<string, unknown>, kind: ScopeKind, config: Record<string, unknown>) {
  const vs = get(item, 'vars', []);
  if (v.array(path, vs, 8)) vs.forEach((e, i) => v.expression(`${path}[${i}]`, e, scope_for(kind, null, config, false)));
}

function blind_actions(v: V, path: string, acts: unknown, when: 'on_set' | 'on_hand') {
  if (!v.array(path, acts, MAX_ACTIONS)) return;
  const scope = scope_for(when === 'on_hand' ? 'blind_hand' : 'blind', null, {});
  acts.forEach((a, i) => {
    const p = `${path}[${i}]`;
    const ok = v.obj(p, a);
    if (!ok || Object.keys(a).length !== 1) { v.err(p, { k: 'blind_one_field' }); return; }
    const [name, arg] = Object.entries(a)[0];
    if (!BLIND_ACTIONS[when].includes(name)) v.err(`${p}.${name}`, { k: 'blind_action', when, options: BLIND_ACTIONS[when] });
    else if (name === 'message') v.string(`${p}.${name}`, arg, 1, 40);
    else if (name === 'hand_size') v.number(`${p}.${name}`, arg, -10, 10, true);
    else v.expression(`${p}.${name}`, arg, scope);
  });
}

const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** the bytes of a base64 text (null: not base64, as Python's b64decode(validate=True) says) */
export function b64_bytes(text: string): Uint8Array | null {
  if (!B64.test(text)) return null;
  try {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const DATA_URL = 'data:image/png;base64,';

/** an image's width and height from its PNG header (null: not a PNG) */
export function png_size(raw: Uint8Array): [number, number] | null {
  if (raw.length < 24 || PNG_SIGNATURE.some((b, i) => raw[i] !== b)) return null;
  if (String.fromCharCode(raw[12], raw[13], raw[14], raw[15]) !== 'IHDR') return null;
  const u32 = (o: number) => ((raw[o] << 24) >>> 0) + (raw[o + 1] << 16) + (raw[o + 2] << 8) + raw[o + 3];
  return [u32(16), u32(20)];
}

function asset(v: V, path: string, name: string, data: unknown) {
  if (!re(ASSET_NAME).test(name)) v.err(path, { k: 'asset_name' });
  if (typeof data !== 'string' || !data.startsWith(DATA_URL)) { v.err(path, { k: 'asset_data_url' }); return; }
  const raw = b64_bytes(data.slice(DATA_URL.length));
  if (raw === null) { v.err(path, { k: 'asset_base64' }); return; }
  if (raw.length > MAX_ASSET_BYTES) v.err(path, { k: 'asset_size', kb: Math.floor(MAX_ASSET_BYTES / 1000) });
  const size = png_size(raw);
  if (size === null) { v.err(path, { k: 'asset_png' }); return; }
  const [w, h] = size;
  if (!(w >= 8 && w <= 1024 && h >= 8 && h <= 1024)) v.err(path, { k: 'asset_dims', w, h });
}

/** What is wrong with a package (empty: it can be played). */
export function validate(pkg: unknown): Issue[] {
  const v = new V();
  if (!v.obj('', pkg, PACKAGE_FIELDS)) return v.issues;
  const size = utf8_size(py_dumps(pkg));
  if (size > MAX_PACKAGE_BYTES) v.err('', { k: 'too_big', max_kb: Math.floor(MAX_PACKAGE_BYTES / 1000), kb: Math.floor(size / 1000) });
  if (!py_eq(get(pkg, 'format', null), FORMAT)) v.err('format', { k: 'format' });
  v.string('id', get(pkg, 'id', null), 3, 32, ID_PATTERN);
  if (in_list(get(pkg, 'id', null), ['pvp', 'coop'])) v.err('id', { k: 'builtin_id' });
  v.string('name', get(pkg, 'name', null), 1, 60);
  v.string('version', get(pkg, 'version', null), 5, 20, VERSION_PATTERN);
  if (has(pkg, 'author')) v.string('author', pkg.author, 0, 60);
  if (has(pkg, 'description')) v.string('description', pkg.description, 0, 2000);
  const tags = get(pkg, 'tags', []);
  if (v.array('tags', tags, 8)) tags.forEach((t, i) => v.string(`tags[${i}]`, t, 1, 24, TAG_PATTERN));
  const loc = get(pkg, 'loc', {});
  if (v.obj('loc', loc)) {
    for (const [lang, t] of Object.entries(loc)) {
      if (v.obj(`loc.${lang}`, t, ['name', 'description'])) {
        for (const [k, hi] of [['name', 60], ['description', 2000]] as const) if (has(t, k)) v.string(`loc.${lang}.${k}`, t[k], 0, hi);
      }
    }
  }
  let assets: Record<string, unknown> | null = (get(pkg, 'assets', null) as Record<string, unknown> | null) ?? null;
  if (assets !== null && v.obj('assets', assets)) {
    if (Object.keys(assets).length > MAX_ASSETS) v.err('assets', { k: 'too_many_assets', n: MAX_ASSETS });
    for (const [k, data] of Object.entries(assets)) asset(v, `assets.${k}`, k, data);
  } else if (assets !== null) {
    assets = {};
  }
  if (has(pkg, 'rules')) modifiers(v, 'rules', pkg.rules, 'start');
  if (has(pkg, 'creative')) v.boolean('creative', pkg.creative);

  items(v, pkg, 'jokers').forEach((j, i) => {
    const p = `jokers[${i}]`;
    v.obj(p, j, JOKER_ITEM_FIELDS);
    text(v, p, j);
    sprite(v, `${p}.sprite`, get(j, 'sprite', null), assets, 'joker');
    v.number(`${p}.rarity`, get(j, 'rarity', 1), 1, 4, true);
    v.number(`${p}.cost`, get(j, 'cost', 5), 1, 50, true);
    for (const k of ['blueprint_compat', 'eternal_compat', 'perishable_compat', 'in_shop']) if (has(j, k)) v.boolean(`${p}.${k}`, j[k]);
    const cfg = config_of(v, `${p}.config`, get(j, 'config', null));
    vars(v, `${p}.vars`, j, 'joker', cfg);
    if (has(j, 'passive')) modifiers(v, `${p}.passive`, j.passive, 'passive');
    effects(v, `${p}.effects`, get(j, 'effects', []), 'joker', JOKER_TRIGGERS, cfg);
  });

  items(v, pkg, 'consumables').forEach((c, i) => {
    const p = `consumables[${i}]`;
    v.obj(p, c, CONSUMABLE_ITEM_FIELDS);
    text(v, p, c);
    sprite(v, `${p}.sprite`, get(c, 'sprite', null), assets, 'consumable');
    v.one_of(`${p}.set`, get(c, 'set', null), CONSUMABLE_SETS);
    v.number(`${p}.cost`, get(c, 'cost', 3), 1, 50, true);
    const cfg = config_of(v, `${p}.config`, get(c, 'config', null));
    vars(v, `${p}.vars`, c, 'consumable', cfg);
    if (has(c, 'hand')) {
      v.one_of(`${p}.hand`, c.hand, POKER_HANDS);
      if (!py_eq(get(c, 'set', null), 'Planet')) v.err(`${p}.hand`, { k: 'planet_hand_only' });
    } else if (py_eq(get(c, 'set', null), 'Planet') && !has(c, 'use')) {
      v.err(p, { k: 'planet_needs_hand' });
    }
    if (has(c, 'targets') && v.obj(`${p}.targets`, c.targets, ['min', 'max'])) {
      const lo = get(c.targets, 'min', 1);
      const hi = get(c.targets, 'max', lo);
      if (v.number(`${p}.targets.min`, lo, 1, 5, true) && v.number(`${p}.targets.max`, hi, 1, 5, true) && lo > hi) {
        v.err(`${p}.targets`, { k: 'min_over_max' });
      }
    }
    const scope = scope_for('consumable', null, cfg);
    if (has(c, 'can_use')) v.expression(`${p}.can_use`, c.can_use, scope_for('consumable', null, cfg, false));
    if (has(c, 'use')) {
      actions(v, `${p}.use`, c.use, 'consumable', null, cfg, scope);
      if (has(c, 'hand')) v.err(`${p}.use`, { k: 'planet_no_use' });
    } else if (!has(c, 'hand')) {
      v.err(p, { k: 'no_use' });
    }
    const use = get(c, 'use', []);
    const uses_selected = Array.isArray(use) && use.some((a) => is_object(a) && is_object(a.modify)
      && py_eq(get(a.modify, 'target', 'selected'), 'selected'));
    if (uses_selected && !has(c, 'targets')) v.err(`${p}.targets`, { k: 'targets_needed' });
  });

  items(v, pkg, 'vouchers').forEach((vo, i) => {
    const p = `vouchers[${i}]`;
    v.obj(p, vo, VOUCHER_ITEM_FIELDS);
    text(v, p, vo);
    sprite(v, `${p}.sprite`, get(vo, 'sprite', null), assets, 'voucher');
    v.number(`${p}.cost`, get(vo, 'cost', 10), 1, 50, true);
    const cfg = config_of(v, `${p}.config`, get(vo, 'config', null));
    vars(v, `${p}.vars`, vo, 'voucher', cfg);
    const req = get(vo, 'requires', []);
    if (v.array(`${p}.requires`, req, 4)) req.forEach((r, k) => v.string(`${p}.requires[${k}]`, r, 3, 64, VOUCHER_KEY));
    if (!has(vo, 'redeem')) v.err(p, { k: 'no_redeem' });
    else actions(v, `${p}.redeem`, vo.redeem, 'voucher', null, cfg, scope_for('voucher', null, cfg));
  });

  items(v, pkg, 'decks').forEach((d, i) => {
    const p = `decks[${i}]`;
    v.obj(p, d, DECK_ITEM_FIELDS);
    text(v, p, d);
    sprite(v, `${p}.sprite`, get(d, 'sprite', null), assets, 'deck');
    vars(v, `${p}.vars`, d, 'deck', {});
    if (has(d, 'start')) modifiers(v, `${p}.start`, d.start, 'start');
    for (const [k, prefix] of [['jokers', 'j_'], ['consumables', 'c_'], ['vouchers', 'v_']] as const) {
      const keys = get(d, k, []);
      if (v.array(`${p}.${k}`, keys, 10)) keys.forEach((key, n) => v.string(`${p}.${k}[${n}]`, key, 3, 64, `^${prefix}[a-z0-9_]+$`));
    }
    const cards = get(d, 'cards', null);
    if (cards !== null && v.obj(`${p}.cards`, cards, ['ranks', 'no_ranks', 'suits', 'no_suits', 'enhancement', 'edition', 'seal'])) {
      for (const [k, options] of [['ranks', RANK_NAMES], ['no_ranks', RANK_NAMES], ['suits', SUITS], ['no_suits', SUITS]] as const) {
        if (has(cards, k) && v.array(`${p}.cards.${k}`, cards[k], 13)) {
          (cards[k] as unknown[]).forEach((x, n) => v.one_of(`${p}.cards.${k}[${n}]`, x, options));
        }
      }
      if (has(cards, 'enhancement')) v.one_of(`${p}.cards.enhancement`, cards.enhancement, ENHANCEMENTS);
      if (has(cards, 'edition')) v.one_of(`${p}.cards.edition`, cards.edition, ['foil', 'holo', 'polychrome']);
      if (has(cards, 'seal')) v.one_of(`${p}.cards.seal`, cards.seal, SEALS);
    }
  });

  items(v, pkg, 'blinds').forEach((b, i) => {
    const p = `blinds[${i}]`;
    v.obj(p, b, BLIND_ITEM_FIELDS);
    text(v, p, b);
    sprite(v, `${p}.sprite`, get(b, 'sprite', null), assets, 'blind');
    v.number(`${p}.mult`, get(b, 'mult', 2), 0.1, 100);
    v.number(`${p}.dollars`, get(b, 'dollars', 5), 0, 50, true);
    v.number(`${p}.min_ante`, get(b, 'min_ante', 1), 1, 39, true);
    v.number(`${p}.max_ante`, get(b, 'max_ante', 10), 1, 39, true);
    if (has(b, 'showdown')) v.boolean(`${p}.showdown`, b.showdown);
    if (has(b, 'colour')) v.string(`${p}.colour`, b.colour, 7, 7, COLOUR);
    vars(v, `${p}.vars`, b, 'blind', {});
    if (has(b, 'debuff_card')) v.expression(`${p}.debuff_card`, b.debuff_card, scope_for('blind_card', null, {}, false));
    if (has(b, 'debuff_hand')) v.expression(`${p}.debuff_hand`, b.debuff_hand, scope_for('blind_hand', null, {}, false));
    for (const k of ['on_set', 'on_hand'] as const) if (has(b, k)) blind_actions(v, `${p}.${k}`, b[k], k);
  });
  return v.issues;
}

// ---------------------------------------------------------------- keys
export type ItemKind = 'jokers' | 'consumables' | 'vouchers' | 'decks' | 'blinds';
export const KINDS: ItemKind[] = ['jokers', 'consumables', 'vouchers', 'decks', 'blinds'];
export const PREFIX: Record<ItemKind, string> = { jokers: 'j', consumables: 'c', vouchers: 'v', decks: 'b', blinds: 'bl' };

/** An item's key in the game: `j_<mod id>_<key>` (a joker), `bl_...` (a blind). */
export function full_key(mod_id: string, kind: ItemKind, key: string): string {
  return `${PREFIX[kind]}_${mod_id}_${key}`;
}

/** The game keys a package names ([path, key]): they must exist when it is played. */
export function references(pkg: Record<string, any>): [string, string][] {
  const out: [string, string][] = [];
  const acts = (path: string, list: unknown) => {
    (Array.isArray(list) ? list : []).forEach((a, i) => {
      if (!is_object(a)) return;
      const c = a.create;
      if (is_object(c) && typeof c.key === 'string') out.push([`${path}[${i}].create.key`, c.key]);
      if (typeof a.add_tag === 'string') out.push([`${path}[${i}].add_tag`, a.add_tag]);
    });
  };
  const list = (k: string): any[] => (Array.isArray(pkg[k]) ? pkg[k] : []);
  list('jokers').forEach((j, i) => (Array.isArray(j?.effects) ? j.effects : []).forEach((eff: any, k: number) => acts(`jokers[${i}].effects[${k}].do`, eff?.do)));
  list('consumables').forEach((c, i) => acts(`consumables[${i}].use`, c?.use));
  list('vouchers').forEach((vo, i) => {
    acts(`vouchers[${i}].redeem`, vo?.redeem);
    (Array.isArray(vo?.requires) ? vo.requires : []).forEach((r: unknown, k: number) => out.push([`vouchers[${i}].requires[${k}]`, String(r)]));
  });
  list('decks').forEach((d, i) => {
    for (const kind of ['jokers', 'consumables', 'vouchers']) {
      (Array.isArray(d?.[kind]) ? d[kind] : []).forEach((key: unknown, k: number) => out.push([`decks[${i}].${kind}[${k}]`, String(key)]));
    }
  });
  list('blinds').forEach((b, i) => {
    const s = b?.sprite;
    if (is_object(s) && typeof s.blind === 'string') out.push([`blinds[${i}].sprite.blind`, s.blind]);
  });
  return out;
}

/** The package without its images: all the engine needs to play it. */
export function logic<T extends Record<string, unknown>>(pkg: T): Omit<T, 'assets'> {
  const { assets: _, ...rest } = pkg;
  return rest;
}
