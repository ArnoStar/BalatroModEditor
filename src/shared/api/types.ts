// What the services answer (BalatroWebAPI's DTOs, the identity service's
// account): the fields the editor reads.
import type { ModPackage } from '@/shared/lib/mod';

export interface SpritePos { x: number; y: number }
export interface CatalogSprite { atlas: string; pos: SpritePos; soul_pos: SpritePos | null }
export interface CatalogItem {
  key: string; name: string; set: string; sprite: CatalogSprite | null; cost: number | null; rarity: number | null;
  config: Record<string, unknown> | null; requires: string[] | null;
}
export interface BlindItem {
  key: string; name: string; boss: boolean; showdown: boolean; min_ante: number | null; dollars: number; mult: number;
  colour: string | null; sprite: CatalogSprite | null;
}
export interface TagItem { key: string; name: string; min_ante: number | null; sprite: CatalogSprite | null }
export interface PokerHandItem {
  name: string; display_name: string; chips: number; mult: number; level_chips: number; level_mult: number; visible: boolean;
}
export interface PlayingCardItem { key: string; name: string; rank: string; suit: string; sprite: CatalogSprite | null }
export interface Catalog {
  game_version: string; engine_version: string;
  decks: CatalogItem[]; challenge_deck: CatalogItem; jokers: CatalogItem[]; tarots: CatalogItem[]; planets: CatalogItem[];
  spectrals: CatalogItem[]; vouchers: CatalogItem[]; boosters: CatalogItem[]; enhancements: CatalogItem[];
  editions: CatalogItem[]; seals: CatalogItem[]; tags: TagItem[]; blinds: BlindItem[]; poker_hands: PokerHandItem[];
  cards: PlayingCardItem[];
  stickers: Record<string, CatalogSprite>;
}
export interface Health { status: string; api_version: string; engine_version: string; game_version: string; auth: 'required' | 'off' }

// ------------------------------------------------------------------ mods
export interface ModCheck {
  valid: boolean; errors: string[]; id: string | null; version: string | null; name: string | null; hash: string | null;
  summary: Record<string, unknown>; size: number;
}
export interface ModSummaryView {
  id: string; name: string; version: string; hash: string; description: string; tags: string[]; author: string | null;
  official: boolean; installs: number; summary: Record<string, unknown>; created_at: string; updated_at: string;
  loc: Record<string, { name?: string; description?: string }>; yours: boolean;
}
export interface ModVersionView { version: string; hash: string; created_at: string; size: number }
export interface ModDetailView extends ModSummaryView { versions: ModVersionView[] }
export interface ModListView { items: ModSummaryView[]; total: number }
/** a mod to play a run with: a package, a published mod (id, version), or a kept package (hash) */
export interface ModChoice { package?: Omit<ModPackage, 'assets'> & { assets?: Record<string, string> }; id?: string; version?: string; hash?: string }

// ------------------------------------------------------------------ runs (the test bench)
export type Phase = 'blind_select' | 'playing' | 'round_eval' | 'shop' | 'pack' | 'game_over' | string;
export interface CardView {
  id: number; kind: 'playing_card' | 'joker' | 'tarot' | 'planet' | 'spectral' | 'voucher' | 'booster';
  face_down: boolean; key: string | null; name: string | null; rank: string | null; suit: string | null; card_key: string | null;
  enhancement: string | null; edition: 'foil' | 'holo' | 'polychrome' | 'negative' | null; seal: 'Gold' | 'Red' | 'Blue' | 'Purple' | null;
  stickers: Record<string, unknown> | null; rarity: number | null; debuffed: boolean; selected: boolean; forced_selection: boolean;
  cost: number | null; sell_value: number | null; bonus_chips: number | null; ability: Record<string, unknown> | null;
}
export interface TagView { key: string; name: string; orbital_hand: string | null }
export interface BlindChoiceView {
  slot: 'Small' | 'Big' | 'Boss'; key: string; name: string; state: string; chips: number; reward: number; skip_tag: TagView | null;
}
export interface BlindView { key: string; name: string; slot: string | null; chips: number; reward: number; boss: boolean; disabled: boolean }
export interface RoundEvalRow { kind: string; dollars: number; key: string | null }
export interface PokerHandView { name: string; display_name: string; level: number; chips: number; mult: number; played: number; visible: boolean }
export interface LegalAction {
  type: string; card: number | null; area: string | null; use: boolean | null; mode: 'rank' | 'suit' | null;
  min_cards: number | null; max_cards: number | null; min_targets: number | null; max_targets: number | null;
  cost: number | null; value: number | null;
}
export interface GameView {
  id: string; version: number; phase: Phase; state: string; won: boolean; ante: number; round: number; dollars: number;
  hands_left: number; discards_left: number; hand_size: number; joker_slots: number; consumable_slots: number;
  round_score: number | null; blind: BlindView | null;
  blind_select: { on_deck: string; choices: BlindChoiceView[]; boss_reroll_cost: number | null } | null;
  hand: CardView[]; jokers: CardView[]; consumables: CardView[];
  deck: { remaining: number; total: number };
  shop: { jokers: CardView[]; vouchers: CardView[]; boosters: CardView[]; reroll_cost: number } | null;
  pack: { kind: string; cards: CardView[]; choices_left: number } | null;
  round_eval: { rows: RoundEvalRow[]; total: number } | null;
  tags: TagView[]; vouchers: string[]; poker_hands: PokerHandView[];
  last_hand: { hand: string; chips: number; mult: number; score: number } | null;
  actions: LegalAction[];
  settings: { seed: string; deck: string; mods?: { id: string; hash: string; creative: boolean }[] };
}
export type GameEvent =
  | { type: 'hand'; t: number; hand?: string | null; level?: number | string | null; chips?: number | string | null; mult?: number | string | null }
  | { type: 'card_text'; t: number; card: number | null; effect: string; amount: number | null; message: string | null; held: boolean; edition: boolean }
  | { type: 'hand_scored'; t: number; hand: string; chips: number; mult: number; score: number; round_score: number }
  | { type: 'dollars'; t: number; amount: number; total: number }
  | { type: 'status_text'; t: number; text: string }
  | { type: 'attention_text'; t: number; card: number; key: string }
  | { type: 'card_changed'; t: number; card: number; change: string; view?: CardView | null }
  | { type: 'card_removed'; t: number; card: number; area: string }
  | { type: 'card_flipped'; t: number; card: number; face_down: boolean; view?: CardView | null }
  | { type: string; t: number; card?: number | null };
export interface ActionResult { game: GameView; events: GameEvent[] }
export interface HandPreview {
  selected: number[]; hand: string | null; display_name: string | null; level: number | null; chips: number | null;
  mult: number | null; scoring: number[]; not_allowed: boolean; hidden: boolean;
}
export type PlayerAction =
  | { type: 'select_blind' | 'skip_blind' | 'reroll_boss' | 'cash_out' | 'reroll' | 'end_shop' | 'skip_pack' }
  | { type: 'play' | 'discard'; cards: number[] }
  | { type: 'sort'; mode: 'rank' | 'suit' }
  | { type: 'buy'; card: number; use?: boolean }
  | { type: 'use' | 'pick'; card: number; targets?: number[] | null }
  | { type: 'sell'; card: number }
  | { type: 'move'; card: number; to: number };
export interface CreativeCommand {
  op: 'set' | 'level' | 'add' | 'add_card' | 'edit' | 'remove' | 'boss' | 'win';
  what?: string; value?: number; hand?: string; key?: string; card?: number; edition?: string; seal?: string;
  enhancement?: string; rank?: string; suit?: string; to?: 'hand' | 'deck'; eternal?: boolean; perishable?: boolean; rental?: boolean;
}
export interface NewGame { seed?: string | null; deck?: string; stake?: number; mods?: ModChoice[] }

// ------------------------------------------------------------------ identity
export interface Account { id: string; email: string; display_name: string; roles?: string[] }
