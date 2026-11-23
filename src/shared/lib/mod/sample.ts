// Sample values for the editor's previews: what an expression gives on a
// typical moment of a run (ante 1, $10, a Pair of 7s just played, the 7 of
// Hearts scoring), and the values a card's description shows (#1#, #2# ...)
// the way the game's front end shows them (entities/mod/model/vars.ts there).
// Random functions don't draw here: the preview says the value is random.
import type { Env } from './expr.ts';
import { value_of } from './expr.ts';

export interface SampleCard {
  rank: number | null; rank_name: string | null; suit: string | null; face: boolean; chips: number | null;
  enhancement: string | null; seal: string | null; edition: string | null; debuffed: boolean; key: string; set: string;
  rarity: number | null; sell_value: number | null; cost: number | null;
}

const RANK_IDS: Record<string, number> = { Jack: 11, Queen: 12, King: 13, Ace: 14 };

export function playing_card(rank_name: string, suit: string, extra: Partial<SampleCard> = {}): SampleCard {
  const rank = RANK_IDS[rank_name] ?? Number(rank_name);
  return {
    rank, rank_name, suit, face: rank >= 11 && rank <= 13, chips: rank === 14 ? 11 : Math.min(rank, 10), enhancement: null,
    seal: null, edition: null, debuffed: false, key: extra.enhancement ?? 'c_base', set: extra.enhancement ? 'Enhanced' : 'Default',
    rarity: null, sell_value: 1, cost: 1, ...extra,
  };
}

export function joker_card(key: string, rarity = 1, sell_value = 2): SampleCard {
  return { rank: null, rank_name: null, suit: null, face: false, chips: null, enhancement: null, seal: null, edition: null,
    debuffed: false, key, set: 'Joker', rarity, sell_value, cost: sell_value * 2 };
}

export interface Sample {
  game: Record<string, unknown>;
  card: SampleCard;
  other: SampleCard;
  hand: Record<string, unknown>;
  joker: Record<string, unknown>;
  blind: Record<string, unknown>;
  event: Record<string, unknown>;
  lists: Record<string, SampleCard[]>;
  hand_levels: Record<string, { level: number; played: number }>;
  vouchers: string[];
}

const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];

export function default_sample(): Sample {
  const full_deck = SUITS.flatMap((s) => RANKS.map((r) => playing_card(r, s)));
  const seven_h = playing_card('7', 'Hearts');
  const seven_s = playing_card('7', 'Spades');
  const held = [playing_card('King', 'Clubs'), playing_card('4', 'Diamonds'), playing_card('Ace', 'Hearts'),
    playing_card('9', 'Spades'), playing_card('2', 'Hearts'), playing_card('Queen', 'Diamonds')];
  return {
    game: {
      money: 10, ante: 1, round: 1, hands_left: 3, discards_left: 3, hands_played: 1, discards_used: 0, hand_size: 8,
      deck_count: 44, full_deck_count: 52, joker_count: 2, joker_slots: 5, consumable_count: 1, consumable_slots: 2,
      probability: 1, blind_boss: false, blind_chips: 300, round_chips: 0, skips: 0, rerolls: 0, interest_cap: 25,
      stake: 1, hands_per_round: 4, discards_per_round: 3,
    },
    card: seven_h,
    other: joker_card('j_joker'),
    hand: { name: 'Pair', level: 1, played: 1, played_this_round: 1, count: 2, scoring_count: 2, chips: 10, mult: 2 },
    joker: { position: 1, sell_value: 2, edition: null },
    blind: { boss: false, key: 'bl_small', chips: 300, mult: 1, dollars: 3 },
    event: { count: 1, faces: 0, glass: 0 },
    lists: {
      scoring: [seven_h, seven_s], played: [seven_h, seven_s], held, deck: full_deck.slice(8), full_deck,
      jokers: [joker_card('j_joker'), joker_card('j_greedy_joker')], consumables: [{ ...joker_card('c_fool'), set: 'Tarot', rarity: null }],
      discarded: [playing_card('3', 'Clubs'), playing_card('5', 'Hearts')], selected: [playing_card('8', 'Diamonds')],
    },
    hand_levels: Object.fromEntries(['Flush Five', 'Flush House', 'Five of a Kind', 'Straight Flush', 'Four of a Kind', 'Full House',
      'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'Pair', 'High Card'].map((h) => [h, { level: 1, played: h === 'Pair' ? 1 : 0 }])),
    vouchers: [],
  };
}

const is_card = (v: unknown): v is SampleCard => !!v && typeof v === 'object' && !Array.isArray(v) && 'set' in (v as object);
const playing = (c: SampleCard) => c.set === 'Default' || c.set === 'Enhanced';

/** an Env on sample values: `values` are the item's own (self.<name>) */
export class SampleEnv implements Env {
  /** a random function was called: the value is random */
  random = false;
  values: Record<string, unknown>;
  sample: Sample;
  constructor(values: Record<string, unknown>, sample: Sample = default_sample()) {
    this.values = values;
    this.sample = sample;
  }

  lookup(root: string, path: string[]): unknown {
    const s = this.sample;
    const first = path[0];
    const one = (v: unknown) => (path.length === 1 ? v ?? null : null);
    switch (root) {
      case 'self': return first === undefined ? null : one(this.values[first]);
      case 'game': return first === undefined ? null : one(s.game[first]);
      case 'hand': return first === undefined ? null : one(s.hand[first]);
      case 'joker': return first === undefined ? null : one(s.joker[first]);
      case 'blind': return first === undefined ? null : one(s.blind[first]);
      case 'event': return first === undefined ? null : one(s.event[first]);
      case 'card': case 'other': {
        const c = root === 'card' ? s.card : s.other;
        return !path.length ? c : one((c as unknown as Record<string, unknown>)[first]);
      }
      default: {
        const list = s.lists[root];
        if (!list) return null;
        return path.length ? null : list;
      }
    }
  }

  field(value: unknown, name: string): unknown {
    return is_card(value) ? ((value as unknown as Record<string, unknown>)[name] ?? null) : null;
  }

  call(name: string, args: unknown[]): unknown {
    const [a, b] = args;
    const list: SampleCard[] = Array.isArray(a) ? (a as SampleCard[]) : [];
    const is_rank = (c: SampleCard, r: unknown) => playing(c) && (typeof r === 'number' ? c.rank === r : c.rank_name === r);
    const is_suit = (c: SampleCard, suit: unknown) => playing(c) && (c.suit === suit || c.enhancement === 'm_wild');
    switch (name) {
      case 'is_suit': return is_card(a) ? is_suit(a, b) : false;
      case 'is_rank': return is_card(a) ? is_rank(a, b) : false;
      case 'is_face': return is_card(a) ? playing(a) && a.face : false;
      case 'count': return list.length;
      case 'count_suit': return list.filter((c) => is_suit(c, b)).length;
      case 'count_rank': return list.filter((c) => is_rank(c, b)).length;
      case 'count_face': return list.filter((c) => playing(c) && c.face).length;
      case 'count_enhancement': case 'count_key': return list.filter((c) => c.key === b).length;
      case 'count_seal': return list.filter((c) => c.seal === b).length;
      case 'count_edition': return list.filter((c) => c.edition === b).length;
      case 'hand_level': return typeof a === 'string' ? this.sample.hand_levels[a]?.level ?? null : null;
      case 'times_played': return typeof a === 'string' ? this.sample.hand_levels[a]?.played ?? null : null;
      case 'has_joker': return this.sample.lists.jokers.some((j) => j.key === a);
      case 'has_voucher': return typeof a === 'string' && this.sample.vouchers.includes(a);
      case 'has_hand': return a === 'Pair' || a === 'High Card';
      case 'chance': case 'random': this.random = true; return null;
      default: return null;
    }
  }
}

/** what an expression gives on the sample (`random`: it draws a random number) */
export function sample_value(src: unknown, values: Record<string, unknown>, sample?: Sample): { value: unknown; random: boolean } {
  const env = new SampleEnv(values, sample);
  const value = value_of(src, env);
  return { value, random: env.random };
}

/** a description's value as the game shows it: nil is '-', fractions have two decimals at most */
export function shown(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return '-';
  if (typeof v === 'object') return '-';
  return String(v);
}

/** an item's description values (#1#, #2# ...) on the sample, as the game shows them */
export function description_vars(vars: unknown[] | undefined, config: Record<string, unknown> | undefined, sample?: Sample): string[] {
  return (vars ?? []).map((e) => shown(sample_value(e, config ?? {}, sample).value));
}
