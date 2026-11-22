// What can be wrong with a package, as data: the validator (spec.ts) gives
// each problem with its place in the package (`jokers[0].effects[1].if`) and
// a message (`Msg`). `engine_text` writes it as the engine does, word for
// word (scripts/parity checks it); the editor shows it in the player's
// language (shared/i18n, `problems`).
import { py_repr } from './py.ts';

export type Msg =
  // ---- the checks every field goes through
  | { k: 'object' }
  | { k: 'unknown_field'; field: string }
  | { k: 'string' }
  | { k: 'length'; lo: number; hi: number }
  | { k: 'pattern'; value: string; pattern: string }
  | { k: 'number' }
  | { k: 'whole' }
  | { k: 'between'; lo: number; hi: number }
  | { k: 'boolean' }
  | { k: 'one_of'; options: string[] }
  | { k: 'list' }
  | { k: 'at_most'; n: number }
  | { k: 'expression_type' }
  // ---- an expression that doesn't parse
  | { k: 'x_char'; ch: string; at: number }
  | { k: 'x_expected'; want: string; found: string }
  | { k: 'x_field_name'; found: string }
  | { k: 'x_unexpected'; found: string }
  | { k: 'x_chain' }
  | { k: 'x_deep' }
  | { k: 'x_long'; max: number }
  | { k: 'x_empty' }
  | { k: 'x_not_string' }
  // ---- an expression that names what isn't there
  | { k: 'x_unknown_name'; name: string }
  | { k: 'x_needs_field'; root: string; fields: string[] }
  | { k: 'x_no_field'; root: string; field: string; fields: string[] }
  | { k: 'x_impure'; fn: string }
  | { k: 'x_unknown_function'; fn: string }
  | { k: 'x_arguments'; fn: string; lo: number; hi: number }
  // ---- the package
  | { k: 'not_json' }
  | { k: 'too_big'; max_kb: number; kb: number }
  | { k: 'format' }
  | { k: 'builtin_id' }
  | { k: 'too_many_assets'; n: number }
  | { k: 'asset_name' }
  | { k: 'asset_data_url' }
  | { k: 'asset_base64' }
  | { k: 'asset_size'; kb: number }
  | { k: 'asset_png' }
  | { k: 'asset_dims'; w: number; h: number }
  | { k: 'key_twice'; key: string }
  | { k: 'language_code' }
  | { k: 'no_asset'; name: string }
  | { k: 'too_many_values'; n: number }
  | { k: 'value_name' }
  | { k: 'value_type' }
  | { k: 'value_long' }
  | { k: 'unknown_modifier'; options: string[] }
  | { k: 'start_only' }
  | { k: 'not_passive' }
  // ---- actions
  | { k: 'one_field_action' }
  | { k: 'unknown_action'; options: string[] }
  | { k: 'only_scores_in'; triggers: string[] }
  | { k: 'only_retrigger' }
  | { k: 'only_joker_values' }
  | { k: 'not_config_value' }
  | { k: 'level_up_played' }
  | { k: 'hand_needed' }
  | { k: 'only_jokers' }
  | { k: 'only_joker_destroys' }
  | { k: 'only_discard' }
  | { k: 'no_card_here' }
  | { k: 'no_played_hand' }
  | { k: 'only_consumable_selected' }
  | { k: 'destroy_selected_only' }
  | { k: 'changes_nothing' }
  | { k: 'do_missing' }
  | { k: 'else_needs_if' }
  // ---- items
  | { k: 'planet_hand_only' }
  | { k: 'planet_needs_hand' }
  | { k: 'min_over_max' }
  | { k: 'planet_no_use' }
  | { k: 'no_use' }
  | { k: 'targets_needed' }
  | { k: 'no_redeem' }
  | { k: 'blind_one_field' }
  | { k: 'blind_action'; when: string; options: string[] }
  // ---- what the engine finds when it plays the package
  | { k: 'no_such_key'; key: string }
  // ---- the editor's own advice (the engine plays these)
  | { k: 'hint_no_art' }
  | { k: 'hint_missing_var'; n: number }
  | { k: 'hint_unused_var'; n: number }
  | { k: 'hint_does_nothing' }
  | { k: 'hint_deck_image' }
  | { k: 'hint_ante_range' }
  | { k: 'hint_never_made' }
  | { k: 'hint_unused_asset' }
  | { k: 'hint_no_description' };

export type MsgKind = Msg['k'];

export type Level = 'error' | 'warning';

export interface Issue {
  /** its place in the package, as the engine writes it: `jokers[0].effects[1].if` (empty: the package itself) */
  path: string;
  msg: Msg;
  /** errors stop the package from being played; warnings are the editor's advice */
  level: Level;
}

const list = (xs: string[]) => xs.join(', ');

/** the message as the engine writes it (English) */
export function message_text(m: Msg): string {
  switch (m.k) {
    case 'object': return 'must be an object';
    case 'unknown_field': return `unknown field ${py_repr(m.field)}`;
    case 'string': return 'must be a string';
    case 'length': return `must have ${m.lo} to ${m.hi} characters`;
    case 'pattern': return `${py_repr(m.value)} doesn't match ${m.pattern}`;
    case 'number': return 'must be a number';
    case 'whole': return 'must be a whole number';
    case 'between': return `must be between ${m.lo} and ${m.hi}`;
    case 'boolean': return 'must be true or false';
    case 'one_of': return `must be one of ${list(m.options)}`;
    case 'list': return 'must be a list';
    case 'at_most': return `has at most ${m.n} entries`;
    case 'expression_type': return 'must be an expression (a string) or a number';
    case 'x_char': return `unexpected ${py_repr(m.ch)} at ${m.at}`;
    case 'x_expected': return `expected ${py_repr(m.want)}, found ${py_repr(m.found || 'the end')}`;
    case 'x_field_name': return `expected a field name after '.', found ${py_repr(m.found || 'the end')}`;
    case 'x_unexpected': return `unexpected ${py_repr(m.found || 'the end')}`;
    case 'x_chain': return "comparisons don't chain: use 'and'";
    case 'x_deep': return 'the expression is nested too deeply';
    case 'x_long': return `an expression has at most ${m.max} characters`;
    case 'x_empty': return 'the expression is empty';
    case 'x_not_string': return 'an expression is a string';
    case 'x_unknown_name': return `unknown name ${py_repr(m.name)}`;
    case 'x_needs_field': return `${py_repr(m.root)} needs a field (${list(m.fields)})`;
    case 'x_no_field': return `${py_repr(m.root)} has no field ${py_repr(m.field)}${m.fields.length ? ` (it has ${list(m.fields)})` : ''}`;
    case 'x_impure': return `${m.fn}() draws a random number: not allowed here (it would change the run where the game only looks)`;
    case 'x_unknown_function': return `unknown function ${py_repr(m.fn)}`;
    case 'x_arguments': return `${m.fn}() takes ${m.lo === m.hi ? m.lo : `${m.lo} to ${m.hi}`} argument${m.hi !== 1 ? 's' : ''}`;
    case 'not_json': return 'is not plain JSON';
    case 'too_big': return `a package has at most ${m.max_kb} kB (${m.kb} kB)`;
    case 'format': return 'must be 1 (the version of this format)';
    case 'builtin_id': return "is a built-in game mode's";
    case 'too_many_assets': return `has at most ${m.n} images`;
    case 'asset_name': return "an asset's name is lowercase letters, digits, _ . -";
    case 'asset_data_url': return 'must be a PNG image as a data URL (data:image/png;base64,...)';
    case 'asset_base64': return "isn't valid base64";
    case 'asset_size': return `an image has at most ${m.kb} kB`;
    case 'asset_png': return "isn't a PNG image";
    case 'asset_dims': return `is ${m.w}x${m.h}: images are 8 to 1024 pixels wide and high`;
    case 'key_twice': return `${py_repr(m.key)} is used twice`;
    case 'language_code': return 'is not a language code (en-us, fr, pt_BR ...)';
    case 'no_asset': return `no asset named ${py_repr(m.name)} in the package's assets`;
    case 'too_many_values': return `has at most ${m.n} values`;
    case 'value_name': return "a value's name is lowercase letters, digits and _";
    case 'value_type': return 'must be a number, a string or true/false';
    case 'value_long': return 'has at most 60 characters';
    case 'unknown_modifier': return `unknown run modifier (they are ${list(m.options)})`;
    case 'start_only': return "only a mod's rules or a deck's start can change it";
    case 'not_passive': return "a joker's passive changes can't include it (use an effect)";
    case 'one_field_action': return 'an action is an object with one field: what it does ({"mult": 4})';
    case 'unknown_action': return `unknown action (they are ${list(m.options)})`;
    case 'only_scores_in': return `only scores in ${list(m.triggers)}`;
    case 'only_retrigger': return 'only in retrigger_scored and retrigger_held';
    case 'only_joker_values': return 'only a joker keeps values';
    case 'not_config_value': return "is not one of the joker's config values";
    case 'level_up_played': return 'levels up the played hand: name the hand ({"hand": "\'Flush\'"}) elsewhere';
    case 'hand_needed': return 'is needed here (there is no played hand)';
    case 'only_jokers': return 'only for jokers';
    case 'only_joker_destroys': return 'only a joker destroys itself';
    case 'only_discard': return 'only in discard (card_destroy destroys the card its condition picks)';
    case 'no_card_here': return 'there is no card here: use scoring, played, held or selected';
    case 'no_played_hand': return 'there is no played hand here';
    case 'only_consumable_selected': return 'only a consumable has selected cards';
    case 'destroy_selected_only': return 'only the selected cards of a consumable (card_destroy and destroy_card do it elsewhere)';
    case 'changes_nothing': return 'changes nothing (enhancement, seal, edition, suit, rank, chips or destroy)';
    case 'do_missing': return 'is missing (the actions)';
    case 'else_needs_if': return 'needs an if';
    case 'planet_hand_only': return 'only a Planet card levels up a hand by itself (use level_up)';
    case 'planet_needs_hand': return 'a Planet card needs a hand (or its own use)';
    case 'min_over_max': return 'min is more than max';
    case 'planet_no_use': return 'a Planet card with a hand levels it up: no use of its own';
    case 'no_use': return 'does nothing: give it a use (actions)';
    case 'targets_needed': return 'is needed: the use changes selected cards';
    case 'no_redeem': return 'does nothing: give it a redeem (actions)';
    case 'blind_one_field': return 'an action is an object with one field';
    case 'blind_action': return `a blind's ${m.when} does ${list(m.options)}`;
    case 'no_such_key': return `there is no ${py_repr(m.key)} (in the game or the run's mods)`;
    case 'hint_no_art': return 'has no picture: the game draws a default one';
    case 'hint_missing_var': return `the text shows #${m.n}#, which has no value (vars)`;
    case 'hint_unused_var': return `value #${m.n}# isn't shown in the text`;
    case 'hint_does_nothing': return 'does nothing yet: give it an effect';
    case 'hint_deck_image': return "the game draws a deck's back from its own art (atlas centers) only";
    case 'hint_ante_range': return 'min_ante is more than max_ante: it never comes';
    case 'hint_never_made': return 'is not in the shop and nothing makes it (a deck, a create action or creative mode can)';
    case 'hint_unused_asset': return 'no item uses this image';
    case 'hint_no_description': return 'has no description (the game shows an empty box)';
  }
}

/** the problem as the engine lists it: `jokers[0].cost: must be between 1 and 50` */
export function engine_text(issue: Issue): string {
  const text = message_text(issue.msg);
  return issue.path ? `${issue.path}: ${text}` : text;
}
