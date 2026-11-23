// A content mod's package as the editor reads it (BalatroEngine's format 1,
// docs/mods.md). Every field may be missing or wrong while it is edited: the
// validator says what; these types say what a field is when it is right.

/** an expression's source (a number or true/false stands for itself) */
export type Expr = string | number | boolean;
export type Value = number | string | boolean;
export type Loc = Record<string, { name?: string; text?: string[] }>;

export type AtlasSprite = { atlas: string; x: number; y: number };
/** an image of the package (its name), a cell of the game's art, or a boss blind's chip */
export type Sprite = string | AtlasSprite | { blind: string };

/** one action: an object with one field (`{"mult": "self.mult"}`) */
export type Action = Record<string, any>;

export interface Effect { on: string; if?: Expr; do?: Action[]; else?: Action[] }

export interface ItemBase {
  key: string;
  name: string;
  text?: string[];
  vars?: Expr[];
  loc?: Loc;
  sprite?: Sprite;
}

export interface Joker extends ItemBase {
  rarity?: number;
  cost?: number;
  config?: Record<string, Value>;
  blueprint_compat?: boolean;
  eternal_compat?: boolean;
  perishable_compat?: boolean;
  in_shop?: boolean;
  passive?: Record<string, number>;
  effects?: Effect[];
}

export interface Consumable extends ItemBase {
  set: 'Tarot' | 'Planet' | 'Spectral';
  cost?: number;
  config?: Record<string, Value>;
  hand?: string;
  targets?: { min?: number; max?: number };
  can_use?: Expr;
  use?: Action[];
}

export interface Voucher extends ItemBase {
  cost?: number;
  config?: Record<string, Value>;
  requires?: string[];
  redeem?: Action[];
}

export interface DeckCards {
  ranks?: string[];
  no_ranks?: string[];
  suits?: string[];
  no_suits?: string[];
  enhancement?: string;
  edition?: string;
  seal?: string;
}

export interface Deck extends ItemBase {
  start?: Record<string, Expr>;
  jokers?: string[];
  consumables?: string[];
  vouchers?: string[];
  cards?: DeckCards;
}

export interface Blind extends ItemBase {
  mult?: number;
  dollars?: number;
  min_ante?: number;
  max_ante?: number;
  showdown?: boolean;
  colour?: string;
  debuff_card?: Expr;
  debuff_hand?: Expr;
  on_set?: Action[];
  on_hand?: Action[];
}

export type AnyItem = Joker | Consumable | Voucher | Deck | Blind;

export interface ModPackage {
  format: 1;
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  tags?: string[];
  loc?: Record<string, { name?: string; description?: string }>;
  rules?: Record<string, Expr>;
  creative?: boolean;
  jokers?: Joker[];
  consumables?: Consumable[];
  vouchers?: Voucher[];
  decks?: Deck[];
  blinds?: Blind[];
  assets?: Record<string, string>;
}
