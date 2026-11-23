// The format library's own tests (npm test): markup, sample values, hashes,
// paths, renames. The validator itself is compared with the engine's by
// `npm run parity`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse_line, vars_in, plain_line } from '../../src/shared/lib/mod/markup.ts';
import { sample_value, shown, description_vars } from '../../src/shared/lib/mod/sample.ts';
import { canonical_json, package_hash } from '../../src/shared/lib/mod/hash.ts';
import { path_str, set_in, get_in, moved } from '../../src/shared/lib/mod/path.ts';
import { rename_field, parse, check, tokens } from '../../src/shared/lib/mod/expr.ts';
import { check_package, own_keys } from '../../src/shared/lib/mod/lint.ts';
import { scope_for } from '../../src/shared/lib/mod/spec.ts';
import { py_number, py_repr } from '../../src/shared/lib/mod/py.ts';

test('markup: parts, controls and vars as the game parses them', () => {
  assert.deepEqual(parse_line('{C:red,s:1.1}+#1#{} Mult'), [
    { strings: ['+', 1], control: { C: 'red', s: '1.1' } },
    { strings: [' Mult'], control: {} },
  ]);
  // (an X box drops its spaces)
  assert.deepEqual(parse_line('{X:mult,C:white} X#1# {} Mult'), [
    { strings: ['X', 1, ''], control: { X: 'mult', C: 'white' } },
    { strings: [' Mult'], control: {} },
  ]);
  assert.equal(parse_line(''), null);
  assert.deepEqual([...vars_in(['#1# and #3#', '{C:mult}#2#{}'])].sort(), [1, 2, 3]);
  assert.equal(plain_line('{C:mult}+#1#{} Mult', ['4']), '+4 Mult');
});

test('sample values: what the previews show', () => {
  assert.deepEqual(sample_value('self.mult + 2', { mult: 4 }), { value: 6, random: false });
  assert.equal(sample_value('card.rank == 7 and is_suit(card, \'Hearts\')', {}).value, true);
  assert.equal(sample_value('chance(1, 4)', {}).random, true);
  assert.equal(sample_value('count_suit(scoring, \'Spades\')', {}).value, 1);
  assert.equal(shown(1.23456), '1.23');
  assert.equal(shown(null), '-');
  assert.deepEqual(description_vars(['self.mult', 'game.probability', 3], { mult: 7 }), ['7', '1', '3']);
});

test('hash: the API hash of every example (as BalatroWebAPI computes it)', async () => {
  const dir = new URL('../../../BalatroEngine/balatro/mods/examples/', import.meta.url).pathname;
  // (the engine's examples, when its checkout is next to this one)
  const files = existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.json')) : [];
  for (const f of files) {
    const pkg = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const h = await package_hash(pkg);
    assert.match(h, /^[0-9a-f]{64}$/);
  }
  assert.equal(canonical_json({ b: 1, a: [1.5, 'é', null, true] }), '{"a":[1.5,"é",null,true],"b":1}');
  assert.equal(py_number(1e-5), '1e-05');
  assert.equal(py_number(0.5), '0.5');
  assert.equal(py_number(1e21), '1e+21');
  assert.equal(py_repr("it's"), '"it\'s"');
});

test('paths: set, get, remove, move', () => {
  const pkg = { jokers: [{ key: 'a', effects: [{ on: 'score' }] }] };
  assert.equal(path_str(['jokers', 0, 'effects', 0, 'if']), 'jokers[0].effects[0].if');
  const changed = set_in(pkg, ['jokers', 0, 'effects', 0, 'if'], 'true');
  assert.equal(get_in(changed, ['jokers', 0, 'effects', 0, 'if']), 'true');
  assert.equal(get_in(pkg, ['jokers', 0, 'effects', 0, 'if']), undefined);
  assert.equal(changed.jokers[0].key, 'a');
  const removed = set_in(changed, ['jokers', 0, 'effects', 0, 'if'], undefined);
  assert.deepEqual(removed.jokers[0].effects[0], { on: 'score' });
  assert.deepEqual(moved([1, 2, 3], 0, 2), [2, 3, 1]);
});

test('expressions: renaming a value, scopes', () => {
  assert.equal(rename_field('self.mult + self.multi * x.mult', 'self', 'mult', 'gain'), 'self.gain + self.multi * x.mult');
  assert.equal(rename_field("'self.mult' + self . mult", 'self', 'mult', 'm'), "'self.mult' + self . m");
  assert.deepEqual(check(parse('hand.name'), scope_for('joker', 'discard', {})), [{ k: 'x_unknown_name', name: 'hand' }]);
  assert.deepEqual(check(parse('card.rank'), scope_for('joker', 'card_scored', {})), []);
  assert.equal(tokens('a.b').length, 4);
});

test('lint: references and advice', () => {
  const pkg = {
    format: 1, id: 'my_mod', name: 'Mine', version: '1.0.0', assets: { unused: 'x' },
    jokers: [{ key: 'a', name: 'A', text: ['+#2# Mult'], vars: ['self.x'], config: { x: 1 }, in_shop: false }],
    decks: [{ key: 'd', name: 'D', text: ['x'], jokers: ['j_nope', 'j_my_mod_a'] }],
  };
  const known = new Set(['j_joker']);
  const issues = check_package(pkg, known);
  const kinds = issues.map((i) => `${i.path}:${i.msg.k}`);
  assert.ok(kinds.includes('decks[0].jokers[0]:no_such_key'));
  assert.ok(!kinds.includes('decks[0].jokers[1]:no_such_key'));
  assert.ok(kinds.includes('jokers[0].text:hint_missing_var'));
  assert.ok(kinds.includes('jokers[0].vars[0]:hint_unused_var'));
  assert.ok(kinds.includes('jokers[0].effects:hint_does_nothing'));
  assert.ok(kinds.includes('jokers[0].sprite:hint_no_art'));
  assert.ok(!kinds.includes('jokers[0].in_shop:hint_never_made'));
  assert.deepEqual([...own_keys(pkg)].sort(), ['b_my_mod_d', 'j_my_mod_a']);
});

import { mod_template, ITEM_TEMPLATES, rename_mod_id, rename_item_key, from_template, blank_item, rename_asset } from '../../src/shared/lib/mod/templates.ts';
import { validate } from '../../src/shared/lib/mod/spec.ts';
import { KINDS } from '../../src/shared/lib/mod/spec.ts';

test('templates: every mod and item template is a valid package', () => {
  for (const id of ['blank', 'jokers', 'everything', 'rules', 'creative'] as const) {
    assert.deepEqual(validate(mod_template(id, 'My Mod', 'my_mod')).map((i) => i.msg.k), [], id);
  }
  for (const tpl of ITEM_TEMPLATES) {
    const pkg: any = mod_template('blank', 'T', 'tpl_mod');
    pkg[tpl.kind] = [from_template(tpl, pkg)];
    const errs = validate(pkg);
    assert.deepEqual(errs, [], `${tpl.id}: ${JSON.stringify(errs)}`);
  }
  for (const kind of KINDS) {
    const pkg: any = mod_template('blank', 'T', 'tpl_mod');
    pkg[kind] = [blank_item(kind, pkg)];
    assert.deepEqual(validate(pkg), [], kind);
  }
});

test('refactoring: renaming the id, an item key and an image follows the references', () => {
  const pkg: any = {
    format: 1, id: 'old_mod', name: 'x', version: '1.0.0', assets: { pic: 'data:image/png;base64,' },
    jokers: [{ key: 'a', name: 'A', sprite: 'pic', text: ['{T:j_old_mod_a}A{} and j_old_mod_ab'], effects: [{ on: 'score', if: "has_joker('j_old_mod_a')", do: [{ create: { set: 'Joker', key: 'j_old_mod_a' } }] }] },
      { key: 'ab', name: 'AB' }],
    vouchers: [{ key: 'v1', name: 'V' }, { key: 'v2', name: 'W', requires: ['v_old_mod_v1'] }],
  };
  const r = rename_mod_id(pkg, 'new_mod');
  assert.equal(r.id, 'new_mod');
  assert.equal(r.jokers[0].text[0], '{T:j_new_mod_a}A{} and j_new_mod_ab');
  assert.equal(r.jokers[0].effects[0].if, "has_joker('j_new_mod_a')");
  assert.equal(r.jokers[0].effects[0].do[0].create.key, 'j_new_mod_a');
  assert.deepEqual(r.vouchers[1].requires, ['v_new_mod_v1']);
  const k = rename_item_key(r, 'jokers', 0, 'z');
  assert.equal(k.jokers[0].key, 'z');
  assert.equal(k.jokers[0].text[0], '{T:j_new_mod_z}A{} and j_new_mod_ab');
  const a = rename_asset(k, 'pic', 'picture');
  assert.equal(a.jokers[0].sprite, 'picture');
  assert.deepEqual(Object.keys(a.assets), ['picture']);
});
