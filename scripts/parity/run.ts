// Parity: the editor's validator (src/shared/lib/mod/spec.ts) against the
// engine's (BalatroEngine balatro/mods/spec.py), on the engine's examples and
// thousands of packages made from them by random changes. Every problem must
// be the same, in the same order and words.
//
//   npm run parity               (needs ../BalatroEngine with its .venv: `uv sync` there)
//   PARITY_CASES=20000 npm run parity
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../../src/shared/lib/mod/spec.ts';
import { engine_text } from '../../src/shared/lib/mod/issues.ts';

const here = dirname(fileURLToPath(import.meta.url));
const engine = resolve(process.env.BALATRO_ENGINE ?? join(here, '../../../BalatroEngine'));
const out_dir = join(here, 'out');
mkdirSync(out_dir, { recursive: true });

const examples_dir = join(engine, 'balatro/mods/examples');
const examples = readdirSync(examples_dir).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(examples_dir, f), 'utf8')));

// ------------------------------------------------------------------ random changes
let seed = Number(process.env.PARITY_SEED ?? 1234567);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_16 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC';
const EXPRESSIONS = [
  'self.mult', 'card.rank == 7', 'chance(1, 4)', 'random(1, 6)', 'chance(1, self.odds, \'x\')', 'is_suit(card, \'Hearts\')',
  'count_suit(scoring, \'Spades\') > 0', 'game.money > 10 and game.ante >= 2', 'if(game.money > 20, 3, 1)', 'hand.name == \'Flush\'',
  'has_hand(\'Pair\')', 'other.rarity', 'joker.position', 'blind.boss', 'event.count', 'count(discarded)', 'count(selected)',
  'card', 'game', 'self', 'hand', 'cardd.rank', 'card.rankk', 'game.mony', 'self.missing', 'foo(1)', 'min()', 'clamp(1, 2)',
  'not card.face', '-self.x ^ 2', '(1 + 2', '1 +', '@', '1 < 2 < 3', '"str"', "'unterminated", 'card..rank', 'x.', 'a b',
  '', '   ', 'nil', 'true', 'false', '1.5', '0', 'max(1, 2, 3)', 'floor(self.mult / 2)', 'times_played(\'Flush\')',
  'hand_level(hand.name)', 'has_joker(\'j_joker\')', 'has_voucher(\'v_blank\')', 'count_key(jokers, \'j_joker\')',
  'count_face(full_deck) + count_rank(deck, \'Ace\')', 'is_rank(card, 7) or is_rank(card, \'Ace\')', 'card.rank % 2 == 0',
  'if(chance(1, 2), 1, 2)', 'self.mult + 2 * count_face(scoring)', 'game.blind_chips / 2', 'selected', 'discarded', 'played',
  'scoring', 'held', 'deck', 'full_deck', 'jokers', 'consumables', 'is_face(other)', 'count_seal(held, \'Red\')',
  'count_edition(jokers, \'foil\')', 'count_enhancement(full_deck, \'m_gold\')', 'abs(-3)', 'round(2.5)', 'ceil(1.2)',
  '((((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))', 'not not not not not 1', '- - - 1',
  'é', 'card.rank == é', '1.', '.5', 'if(1, 2)', 'random(1)', 'chance(1, 2, 3, 4)', 'a' + 'b'.repeat(520),
];
const TRIGGERS = ['hand_played', 'card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'score', 'other_joker',
  'hand_finished', 'discard', 'discard_start', 'round_end', 'cash_out', 'card_destroy', 'blind_selected', 'first_hand_drawn',
  'shop_reroll', 'shop_exit', 'blind_skipped', 'pack_opened', 'pack_skipped', 'card_bought', 'card_sold', 'sold',
  'consumable_used', 'cards_added', 'cards_destroyed', 'hand_not_allowed', 'nonsense', 3, null];
const ACTIONS: unknown[] = [
  { mult: 'self.mult' }, { chips: 5 }, { xmult: 2 }, { dollars: 'game.money' }, { retrigger: 1 }, { set: { mult: 1 } },
  { set: { nope: 'self.mult + 1' } }, { message: 'k_upgrade_ex' }, { message: '' }, { level_up: 1 }, { level_up: { levels: 2 } },
  { level_up: { hand: "'Flush'", levels: 2 } }, { level_up: { hand: "'Flush'", x: 1 } }, { level_up: true },
  { create: { set: 'Joker', rarity: 2 } }, { create: { set: 'Tarot', key: 'c_fool' } }, { create: { set: 'Tarot', rarity: 2 } },
  { create: { set: 'Moon' } }, { create: { set: 'Joker', edition: 'negative', key: 'J' } }, { destroy_self: true },
  { destroy_card: true }, { destroy_card: 1 }, { hands: 1 }, { discards: -1 }, { modify_run: { hand_size: 1 } },
  { modify_run: { hand_size: 'self.mult' } }, { modify_run: { win_ante: 2 } }, { modify_run: { nope: 1 } },
  { modify: { target: 'held', seal: 'Red' } }, { modify: { enhancement: 'm_gold' } }, { modify: { target: 'selected', destroy: true } },
  { modify: { target: 'scoring', where: 'card.rank > 5', chips: 'card.chips' } }, { modify: { target: 'card' } },
  { modify: { rank: 'up', suit: 'Hearts', edition: 'holo' } }, { modify: { destroy: true } }, { modify: { target: 'nowhere', seal: 'none' } },
  { add_tag: 'tag_double' }, { add_tag: 'double' }, { disable_boss: true }, { nope: 1 }, { mult: 1, chips: 2 }, {}, [], 'mult', null,
];
const VALUES: unknown[] = [null, true, false, 0, -1, 1, 2, 1.5, 3.25, 1e9, -1e9, 0.001, 1e-5, 5, 50, 51, 100, '', 'x', 'Hearts',
  'Joker', 'Tarot', 'Planet', 'Spectral', 'Flush', 'Pair', 'm_gold', 'Red', 'foil', 'negative', 'Ace', '10', 'up', 'abc', 'ab',
  'a_b_c', 'Bad Key', 'bl_hook', 'j_joker', 'v_blank', 'c_fool', 'tag_double', '#c9a227', '#zzzzzz', 'fr', 'pt_BR', 'en-us',
  'EN', '1.0.0', '1.0', '01.0.0', [], [1], ['Hearts'], ['2', '3'], {}, { a: 1 }, { atlas: 'Joker', x: 0, y: 0 },
  { atlas: 'Joker', x: 10, y: 0 }, { atlas: 'Nope', x: 0, y: 0 }, { blind: 'bl_hook' }, { blind: 'hook' }, 'x'.repeat(61),
  'y'.repeat(2001), `data:image/png;base64,${PNG_16}`, `data:image/png;base64,${PNG_1x1}`, 'data:image/png;base64,@@@',
  'data:image/jpeg;base64,AAAA', 'data:image/png;base64,AAAA', ...EXPRESSIONS.slice(0, 30)];
const FIELDS = ['key', 'name', 'text', 'vars', 'loc', 'sprite', 'rarity', 'cost', 'config', 'blueprint_compat', 'eternal_compat',
  'perishable_compat', 'passive', 'effects', 'in_shop', 'set', 'hand', 'targets', 'can_use', 'use', 'requires', 'redeem',
  'start', 'jokers', 'consumables', 'vouchers', 'cards', 'mult', 'dollars', 'min_ante', 'max_ante', 'showdown', 'colour',
  'debuff_card', 'debuff_hand', 'on_set', 'on_hand', 'format', 'id', 'version', 'author', 'description', 'tags', 'rules',
  'creative', 'assets', 'blinds', 'decks', 'nonsense', 'if', 'do', 'else', 'on', 'min', 'max', 'atlas', 'x', 'y',
  'ranks', 'no_ranks', 'suits', 'no_suits', 'enhancement', 'edition', 'seal', 'hand_size', 'interest_cap', 'probability_mult',
  'win_ante', 'blind_scale', 'dollars', 'hands', 'discards', 'joker_slots', 'shop_slots'];

type Box = { parent: any; key: string | number };

function boxes(root: any): Box[] {
  const out: Box[] = [];
  const walk = (x: any) => {
    if (Array.isArray(x)) x.forEach((v, i) => { out.push({ parent: x, key: i }); walk(v); });
    else if (x && typeof x === 'object') for (const k of Object.keys(x)) { out.push({ parent: x, key: k }); walk(x[k]); }
  };
  walk(root);
  return out;
}

function mutate_string(s: string): string {
  const r = rnd();
  if (r < 0.3) return pick(EXPRESSIONS);
  if (r < 0.5 && s.length) { const i = Math.floor(rnd() * s.length); return s.slice(0, i) + s.slice(i + 1); }
  if (r < 0.7) { const i = Math.floor(rnd() * (s.length + 1)); return s.slice(0, i) + pick(['(', ')', '.', ' and ', ' + ', '@', "'", 'x', '_', '#', '{', '}', 'A', '1']) + s.slice(i); }
  if (r < 0.85) return s + pick([' + 1', ' and card', '.x', ' or nil', '(', ' == ']);
  return pick(VALUES.filter((v) => typeof v === 'string')) as string;
}

function mutate(pkg: any): void {
  const all = boxes(pkg);
  if (!all.length) return;
  const b = pick(all);
  const cur = b.parent[b.key];
  const r = rnd();
  if (r < 0.15 && !Array.isArray(b.parent)) delete b.parent[b.key];
  else if (r < 0.22 && Array.isArray(b.parent)) b.parent.splice(b.key as number, 1);
  else if (r < 0.45 && typeof cur === 'string') b.parent[b.key] = mutate_string(cur);
  else if (r < 0.55) b.parent[b.key] = clone(pick(VALUES));
  else if (r < 0.62 && cur && typeof cur === 'object' && !Array.isArray(cur)) cur[pick(FIELDS)] = clone(pick(VALUES));
  else if (r < 0.7 && Array.isArray(cur)) cur.push(clone(cur.length ? pick(cur) : pick(VALUES)));
  else if (r < 0.78 && Array.isArray(cur) && b.key === 'do' || b.key === 'else' || b.key === 'use' || b.key === 'redeem') {
    const list = Array.isArray(cur) ? cur : (b.parent[b.key] = []);
    list.push(clone(pick(ACTIONS)));
  } else if (r < 0.84 && b.key === 'on') b.parent[b.key] = pick(TRIGGERS);
  else if (r < 0.9 && typeof cur === 'number') b.parent[b.key] = pick([cur + 1, cur - 1, -cur, cur * 100, cur / 3, 0]);
  else if (r < 0.95 && cur && typeof cur === 'object' && !Array.isArray(cur)) {
    const keys = Object.keys(cur);
    if (keys.length) { const k = pick(keys); const v = cur[k]; delete cur[k]; cur[pick(FIELDS)] = v; }
  } else b.parent[b.key] = typeof cur === 'string' ? mutate_string(cur) : clone(pick(VALUES));
}

function hand_made(): unknown[] {
  const base = clone(examples.find((e) => e.id === 'fruit_stand') ?? examples[0]);
  const cases: unknown[] = [
    null, 5, 'x', [], {}, { format: 1 }, { format: true, id: 'pvp', name: 'x', version: '1.0.0' },
    { format: 2, id: 'ab', name: '', version: '1' }, { format: 1, id: 'Abc', name: 'x'.repeat(61), version: '1.0.0.0' },
    { format: 1, id: 'abc\n', name: 'x', version: '1.0.0' },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', assets: [] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', assets: { 'Bad Name': 'x', ok: `data:image/png;base64,${PNG_1x1}`, ok2: `data:image/png;base64,${PNG_16}` } },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', jokers: [{ key: 'a' }, { key: 'a' }, 5, { key: 'B' }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', jokers: [{ key: 'a', name: 'A', sprite: 'missing' }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', assets: {}, jokers: [{ key: 'a', name: 'A', sprite: 'missing', config: { mult: 1, 'Bad': [], s: 'x'.repeat(61) }, effects: [{ on: 'score', do: [{ set: { mult: 'self.mult + 1' } }, { mult: 'self.mult' }] }, { on: 'discard', else: [] }, { on: 'card_destroy', if: 'card.face' }] }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', consumables: [{ key: 'p', name: 'P', set: 'Planet' }, { key: 'q', name: 'Q', set: 'Tarot', hand: 'Pair', use: [] }, { key: 'r', name: 'R', set: 'Tarot', use: [{ modify: { seal: 'Red' } }] }, { key: 's', name: 'S', set: 'Spectral', targets: { min: 3, max: 2 }, can_use: 'chance(1, 2)', use: [{ level_up: { levels: 1 } }] }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', vouchers: [{ key: 'v', name: 'V' }, { key: 'w', name: 'W', requires: ['x', 'v_ok'], redeem: [{ modify: { seal: 'Red' } }, { destroy_self: true }] }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', decks: [{ key: 'd', name: 'D', sprite: { atlas: 'centers', x: 9, y: 9 }, jokers: ['x_joker'], cards: { ranks: ['1'], suits: ['Stars'], enhancement: 'm_none', edition: 'negative', seal: 'Black' } }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', blinds: [{ key: 'b', name: 'B', mult: 0, dollars: 1.5, min_ante: 0, max_ante: 40, colour: 'red', on_set: [{ hand_size: 1.5 }, { message: '' }, 5, { a: 1, b: 2 }, { chips: 1 }], on_hand: [{ hands: 1 }] }] },
    { format: 1, id: 'ok_mod', name: 'Ok', version: '1.0.0', rules: { win_ante: 2, blind_scale: 0, nope: 1, probability_mult: 1001 }, creative: 1, tags: ['ok', 'Bad', ''], loc: { ru: { name: 'x', description: 5, other: 1 }, x: 5 } },
    base,
    // (the rarer problems, one case each)
    { format: 1, id: 'big_mod', name: 'Big', version: '1.0.0', assets: { huge: 'data:image/png;base64,' + 'A'.repeat(1_600_000) } },
    { format: 1, id: 'big_mod', name: 'Big', version: '1.0.0', assets: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`a${i}`, `data:image/png;base64,${PNG_16}`])) },
    { format: 1, id: 'big_mod', name: 'Big', version: '1.0.0', assets: { fat: 'data:image/png;base64,' + Buffer.concat([Buffer.from(PNG_16, 'base64').subarray(0, 24), Buffer.alloc(300_000)]).toString('base64') } },
    { format: 1, id: 'big_mod', name: 'Big', version: '1.0.0', assets: { wide: 'data:image/png;base64,' + Buffer.concat([Buffer.from(PNG_16, 'base64').subarray(0, 16), Buffer.from([0, 0, 8, 0, 0, 0, 0, 4])]).toString('base64') } },
    { format: 1, id: 'cfg_mod', name: 'Cfg', version: '1.0.0', jokers: [{ key: 'a', name: 'A', config: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`v${i}`, i])), passive: { win_ante: 1, dollars: 2, hand_size: 'x' }, effects: [
      { on: 'discard', do: [{ level_up: 1 }, { modify: { target: 'held', destroy: true } }, { modify: { target: 'selected', seal: 'Red' } }, { modify_run: { blind_scale: 2 } }] },
      { on: 'score', if: '(((((((((((((((((((((((((((((((((((((((1)))))))))))))))))))))))))))))))))))))))', do: [{ mult: 1 }] },
      { on: 'score', if: '1 .', do: [{ retrigger: 1 }] },
    ] }], vouchers: [{ key: 'v', name: 'V', redeem: [{ set: { a: 1 } }, { level_up: 2 }, { modify: { target: 'card', rank: 'Ace' } }] }] },
    { format: 1, id: 'cfg_mod', name: 'Cfg', version: '1.0.0', consumables: [{ key: 'c', name: 'C', set: 'Planet', hand: 'Pair', use: [{ dollars: 1 }], vars: ['chance(1, 2)', 'random(1, 2)'] }] },
  ];
  for (const ex of examples) cases.push(clone(ex));
  return cases;
}

const n = Number(process.env.PARITY_CASES ?? 4000);
const cases: unknown[] = hand_made();
for (let i = 0; i < n; i++) {
  const pkg = clone(pick(examples));
  const changes = 1 + Math.floor(rnd() * 4);
  for (let k = 0; k < changes; k++) mutate(pkg);
  cases.push(pkg);
}

const cases_file = join(out_dir, 'cases.json');
const engine_file = join(out_dir, 'engine.json');
writeFileSync(cases_file, JSON.stringify(cases));
const t0 = Date.now();
const ours = cases.map((pkg) => validate(pkg).map(engine_text));
const t_ours = Date.now() - t0;
const python = join(engine, '.venv/bin/python');
execFileSync(python, [join(here, 'engine.py'), cases_file, engine_file], { stdio: 'inherit' });
const theirs: (string[] | { crash: string })[] = JSON.parse(readFileSync(engine_file, 'utf8'));

let same = 0;
let crashes = 0;
const differ: number[] = [];
cases.forEach((_, i) => {
  const t = theirs[i];
  if (!Array.isArray(t)) { crashes++; return; }
  if (JSON.stringify(t) === JSON.stringify(ours[i])) same++;
  else differ.push(i);
});
console.log(`${cases.length} packages: ${same} the same, ${differ.length} different, ${crashes} the engine can't check (it crashes) — ours in ${t_ours} ms`);
for (const i of differ.slice(0, 12)) {
  const t = theirs[i] as string[];
  const o = ours[i];
  console.log(`\n#${i}`);
  for (const line of t) if (!o.includes(line)) console.log(`  engine only: ${line}`);
  for (const line of o) if (!t.includes(line)) console.log(`  ours only:   ${line}`);
  if (t.every((l) => o.includes(l)) && o.every((l) => t.includes(l))) console.log(`  (the same problems, another order)\n  engine: ${t.join(' | ')}\n  ours:   ${o.join(' | ')}`);
}
const crash_samples = theirs.map((t, i) => [t, i] as const).filter(([t]) => !Array.isArray(t)).slice(0, 3);
for (const [t, i] of crash_samples) console.log(`\nengine crash #${i}: ${(t as { crash: string }).crash}`);
process.exit(differ.length ? 1 : 0);
