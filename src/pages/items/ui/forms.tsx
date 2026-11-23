// The form of each kind of item: jokers, consumables, vouchers, decks and boss
// blinds, with everything the format lets them have.
import { KeyPicker, useCatalog, type PickKind } from '@/entities/catalog';
import { use_field_issues } from '@/entities/project';
import { ModifiersEditor } from '@/features/run-modifiers';
import { useI18n } from '@/shared/i18n';
import {
  BLIND_ACTIONS, ENHANCEMENTS, POKER_HANDS, RANK_NAMES, SEALS, SUITS, scope_for, type ItemKind,
} from '@/shared/lib/mod';
import { ColourInput, ExpressionInput, Field, IconButton, NumberInput, Section, Segmented, Select, Toggle } from '@/shared/ui';
import { use_item, use_literals, use_own_items } from '../model/item';
import { ActionsEditor } from './actions';
import { ConfigSection, IdentityFields, TextSection, TranslationsSection } from './common';
import { EffectsEditor } from './effects';
import { PictureSection } from './sprite-picker';

const RARITY_COLOURS = ['#009dff', '#4bc292', '#fe5f55', '#b26cbb'];

function HandSelect({ id, value, onChange }: { id: string; value: string; onChange: (h: string) => void }) {
  const cat = useCatalog();
  return <Select<string> id={id} value={value} onChange={onChange} options={POKER_HANDS.map((h) => ({ value: h, label: cat.hand_name(h) }))} />;
}

function Num({ kind, index, field, label, help, def, min, max, step = 1, integer = true }: {
  kind: ItemKind; index: number; field: string; label: string; help?: string; def: number; min?: number; max?: number; step?: number; integer?: boolean;
}) {
  const { item, ps, put } = use_item(kind, index);
  const errors = use_field_issues(ps(field));
  const v = item?.[field];
  return (
    <Field path={ps(field)} label={label} help={help} errors={errors}>
      {(id, d) => (
        <NumberInput id={id} describedby={d} value={typeof v === 'number' ? v : def} min={min} max={max} step={step} integer={integer}
          onChange={(n) => put(field, n === null || n === def ? undefined : n)} />
      )}
    </Field>
  );
}

function Flag({ kind, index, field, label, help, def = true }: { kind: ItemKind; index: number; field: string; label: string; help?: string; def?: boolean }) {
  const { item, ps, put } = use_item(kind, index);
  const v = item?.[field];
  return (
    <div data-path={ps(field)} className="flag">
      <Toggle checked={typeof v === 'boolean' ? v : def} onChange={(b) => put(field, b === def ? undefined : b)} label={label} />
      {help ? <p className="field__help">{help}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ jokers
export function JokerForm({ index }: { index: number }) {
  const { t } = useI18n();
  const literals = use_literals();
  const { item, ps, put } = use_item('jokers', index);
  const config = (item?.config ?? {}) as Record<string, unknown>;
  const rarity = typeof item?.rarity === 'number' ? item.rarity : 1;
  return (
    <>
      <Section title={t.items.sections.card} id="card">
        <IdentityFields kind="jokers" index={index} />
        <div className="grid-2">
          <Field path={ps('rarity')} label={t.items.rarity} help={rarity === 4 ? t.items.legendary_help : undefined}>
            {() => (
              <Segmented label={t.items.rarity} value={rarity} onChange={(r) => put('rarity', r === 1 ? undefined : r)}
                options={t.items.rarities.map((r, i) => ({ value: i + 1, label: r, colour: RARITY_COLOURS[i] }))} />
            )}
          </Field>
          <Num kind="jokers" index={index} field="cost" label={t.items.cost} help={t.items.cost_help} def={5} min={1} max={50} />
        </div>
        <div className="flags">
          <Flag kind="jokers" index={index} field="in_shop" label={t.items.in_shop} help={t.items.in_shop_help} />
          <Flag kind="jokers" index={index} field="blueprint_compat" label={t.items.blueprint_compat} />
          <Flag kind="jokers" index={index} field="eternal_compat" label={t.items.eternal_compat} />
          <Flag kind="jokers" index={index} field="perishable_compat" label={t.items.perishable_compat} />
        </div>
      </Section>
      <Section title={t.items.sections.look} id="look"><PictureSection kind="jokers" index={index} /></Section>
      <TextSection kind="jokers" index={index} />
      <ConfigSection kind="jokers" index={index} />
      <Section title={t.items.sections.effects} help={t.items.effects_help} id="effects" tone="#3d9bff">
        <EffectsEditor effects={item?.effects} path={ps('effects')} config={config} literals={literals} onChange={(e) => put('effects', e)} />
      </Section>
      <Section title={t.items.sections.passive} help={t.items.passive_help} id="passive">
        <ModifiersEditor value={item?.passive} onChange={(v) => put('passive', v)} context="passive" path={ps('passive')} />
      </Section>
      <TranslationsSection kind="jokers" index={index} />
    </>
  );
}

// ------------------------------------------------------------------ consumables
export function ConsumableForm({ index }: { index: number }) {
  const { t } = useI18n();
  const literals = use_literals();
  const { item, ps, put, edit } = use_item('consumables', index);
  const config = (item?.config ?? {}) as Record<string, unknown>;
  const set = String(item?.set ?? 'Tarot');
  const planet_hand = set === 'Planet' && 'hand' in (item ?? {});
  const hand_errors = use_field_issues(ps('hand'));
  const targets_errors = use_field_issues(ps('targets'), true);
  const can_use_errors = use_field_issues(ps('can_use'));
  const targets = item?.targets as { min?: number; max?: number } | undefined;
  const change_set = (s: string) => edit((it) => {
    const next = { ...it, set: s };
    if (s === 'Planet' && !('use' in next) && !('hand' in next)) next.hand = 'Pair';
    if (s !== 'Planet' && 'hand' in next) { delete next.hand; if (!('use' in next)) next.use = []; }
    if (s === 'Planet' && 'hand' in next) delete next.use;
    return next;
  });
  return (
    <>
      <Section title={t.items.sections.card} id="card">
        <IdentityFields kind="consumables" index={index} />
        <div className="grid-2">
          <Field path={ps('set')} label={t.items.set}>
            {() => (
              <Segmented label={t.items.set} value={set} onChange={change_set}
                options={(['Tarot', 'Planet', 'Spectral'] as const).map((x) => ({ value: x, label: t.items.sets[x], colour: x === 'Tarot' ? '#a782d1' : x === 'Planet' ? '#13afce' : '#4584fa' }))} />
            )}
          </Field>
          <Num kind="consumables" index={index} field="cost" label={t.items.cost} def={set === 'Spectral' ? 4 : 3} min={1} max={50} />
        </div>
      </Section>
      <Section title={t.items.sections.look} id="look"><PictureSection kind="consumables" index={index} /></Section>
      <TextSection kind="consumables" index={index} />
      <ConfigSection kind="consumables" index={index} />
      <Section title={t.items.sections.use} help={t.items.use_help} id="use" tone="#a782d1">
        {set === 'Planet' ? (
          <Field label={t.items.planet_mode}>
            {() => (
              <Segmented label={t.items.planet_mode} value={planet_hand ? 'hand' : 'use'}
                onChange={(m) => edit((it) => { const n = { ...it }; if (m === 'hand') { n.hand = 'Pair'; delete n.use; } else { delete n.hand; n.use = []; } return n; })}
                options={[{ value: 'hand', label: t.items.planet_hand }, { value: 'use', label: t.items.planet_use }]} />
            )}
          </Field>
        ) : null}
        {planet_hand ? (
          <Field path={ps('hand')} label={t.items.hand} errors={hand_errors}>
            {(id) => <HandSelect id={id} value={item.hand} onChange={(h) => put('hand', h)} />}
          </Field>
        ) : (
          <>
            <Field path={ps('targets')} label={t.items.targets} errors={targets_errors}>
              {() => (
                <div className="targets">
                  <Toggle checked={!!targets} onChange={(on) => put('targets', on ? { min: 1, max: 1 } : undefined)} label={targets ? '' : t.items.targets_none} />
                  {targets ? (
                    <>
                      <label className="inline">{t.items.targets_min} <NumberInput value={targets.min ?? 1} min={1} max={5} integer onChange={(n) => put('targets', { ...targets, min: n ?? 1 })} /></label>
                      <label className="inline">{t.items.targets_max} <NumberInput value={targets.max ?? targets.min ?? 1} min={1} max={5} integer onChange={(n) => put('targets', { ...targets, max: n ?? 1 })} /></label>
                    </>
                  ) : null}
                </div>
              )}
            </Field>
            <Field path={ps('can_use')} label={t.items.can_use} help={t.items.can_use_help} errors={can_use_errors}>
              {(id, d) => (
                <ExpressionInput id={id} describedby={d} value={item?.can_use} onChange={(v) => put('can_use', v === '' ? undefined : v)}
                  scope={scope_for('consumable', null, config, false)} values={config} literals={literals} condition />
              )}
            </Field>
            <ActionsEditor actions={item?.use} path={ps('use')} onChange={(a) => put('use', a)}
              c={{ kind: 'consumable', trigger: null, config, scope: scope_for('consumable', null, config), literals }} />
          </>
        )}
      </Section>
      <TranslationsSection kind="consumables" index={index} />
    </>
  );
}

// ------------------------------------------------------------------ vouchers
export function VoucherForm({ index }: { index: number }) {
  const { t } = useI18n();
  const literals = use_literals();
  const own = use_own_items('vouchers');
  const { item, ps, put } = use_item('vouchers', index);
  const config = (item?.config ?? {}) as Record<string, unknown>;
  const requires: string[] = Array.isArray(item?.requires) ? item.requires : [];
  const req_errors = use_field_issues(ps('requires'), true);
  return (
    <>
      <Section title={t.items.sections.card} id="card">
        <IdentityFields kind="vouchers" index={index} />
        <div className="grid-2">
          <Num kind="vouchers" index={index} field="cost" label={t.items.cost} def={10} min={1} max={50} />
        </div>
      </Section>
      <Section title={t.items.sections.look} id="look"><PictureSection kind="vouchers" index={index} /></Section>
      <TextSection kind="vouchers" index={index} />
      <ConfigSection kind="vouchers" index={index} />
      <Section title={t.items.requires} help={t.items.requires_help} id="requires">
        <Field path={ps('requires')} label={t.items.requires} errors={req_errors}>
          {() => (
            <KeyList value={requires} onChange={(l) => put('requires', l.length ? l : undefined)} kinds={['vouchers']} extra={own} max={4} label={t.items.requires} />
          )}
        </Field>
      </Section>
      <Section title={t.items.sections.redeem} help={t.items.redeem_help} id="redeem" tone="#fd682b">
        <ActionsEditor actions={item?.redeem} path={ps('redeem')} onChange={(a) => put('redeem', a)}
          c={{ kind: 'voucher', trigger: null, config, scope: scope_for('voucher', null, config), literals }} />
      </Section>
      <TranslationsSection kind="vouchers" index={index} />
    </>
  );
}

/** a list of keys, each chosen with a picker */
export function KeyList({ value, onChange, kinds, extra, max, label }: {
  value: string[]; onChange: (v: string[]) => void; kinds: PickKind[]; extra?: ReturnType<typeof use_own_items>; max: number; label: string;
}) {
  const { t } = useI18n();
  return (
    <div className="key-list">
      {value.map((k, i) => (
        <div key={i} className="key-list__row">
          <KeyPicker label={label} value={k} kinds={kinds} extra={extra} onChange={(x) => onChange(x ? value.map((y, j) => (j === i ? x : y)) : value.filter((_, j) => j !== i))} compact />
          <IconButton size="sm" icon="trash" label={t.common.remove} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      {value.length < max ? (
        <KeyPicker label={label} value={undefined} kinds={kinds} extra={extra} placeholder={`+ ${t.items.deck.add}`} onChange={(x) => { if (x) onChange([...value, x]); }} compact />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ decks
export function DeckForm({ index }: { index: number }) {
  const { t } = useI18n();
  const cat = useCatalog();
  const own_jokers = use_own_items('jokers');
  const own_cons = use_own_items('consumables');
  const own_vouchers = use_own_items('vouchers');
  const { item, ps, put } = use_item('decks', index);
  const cards = (item?.cards ?? {}) as Record<string, any>;
  const cards_errors = use_field_issues(ps('cards'), true);
  const put_cards = (k: string, v: unknown) => {
    const next = { ...cards };
    if (v === undefined || (Array.isArray(v) && !v.length)) delete next[k];
    else next[k] = v;
    put('cards', Object.keys(next).length ? next : undefined);
  };
  const mode = (yes: string, no: string) => (cards[yes] ? 'only' : cards[no] ? 'without' : 'all');
  const rank_mode = mode('ranks', 'no_ranks');
  const suit_mode = mode('suits', 'no_suits');
  const ranks: string[] = cards.ranks ?? cards.no_ranks ?? [];
  const suits: string[] = cards.suits ?? cards.no_suits ?? [];
  const set_mode = (yes: string, no: string, m: string, list: string[]) => {
    const next = { ...cards };
    delete next[yes];
    delete next[no];
    if (m === 'only') next[yes] = list.length ? list : [yes === 'ranks' ? 'Ace' : 'Hearts'];
    if (m === 'without') next[no] = list.length ? list : [yes === 'ranks' ? '2' : 'Clubs'];
    put('cards', Object.keys(next).length ? next : undefined);
  };
  const toggle = (yes: string, no: string, m: string, x: string, list: string[]) => {
    const l = list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
    put_cards(m === 'only' ? yes : no, l);
  };
  const count = (rank_mode === 'all' ? 13 : rank_mode === 'only' ? ranks.length : 13 - ranks.length)
    * (suit_mode === 'all' ? 4 : suit_mode === 'only' ? suits.length : 4 - suits.length);
  const list = (k: 'jokers' | 'consumables' | 'vouchers') => (Array.isArray(item?.[k]) ? item[k] : []);
  return (
    <>
      <Section title={t.items.sections.card} id="card"><IdentityFields kind="decks" index={index} /></Section>
      <Section title={t.items.sections.look} id="look"><PictureSection kind="decks" index={index} /></Section>
      <TextSection kind="decks" index={index} />
      <Section title={t.items.sections.start} help={t.items.start_help} id="start" tone="#4bc292">
        <ModifiersEditor value={item?.start} onChange={(v) => put('start', v)} context="start" path={ps('start')} />
      </Section>
      <Section title={t.items.sections.starting_items} id="starting">
        <div className="grid-3">
          <Field path={ps('jokers')} label={t.items.deck.starting_jokers}>
            {() => <KeyList value={list('jokers')} onChange={(l) => put('jokers', l.length ? l : undefined)} kinds={['jokers']} extra={own_jokers} max={10} label={t.items.deck.starting_jokers} />}
          </Field>
          <Field path={ps('consumables')} label={t.items.deck.starting_consumables}>
            {() => <KeyList value={list('consumables')} onChange={(l) => put('consumables', l.length ? l : undefined)} kinds={['tarots', 'planets', 'spectrals']} extra={own_cons} max={10} label={t.items.deck.starting_consumables} />}
          </Field>
          <Field path={ps('vouchers')} label={t.items.deck.starting_vouchers}>
            {() => <KeyList value={list('vouchers')} onChange={(l) => put('vouchers', l.length ? l : undefined)} kinds={['vouchers']} extra={own_vouchers} max={10} label={t.items.deck.starting_vouchers} />}
          </Field>
        </div>
      </Section>
      <Section title={t.items.sections.cards} id="cards" actions={<span className="badge badge--neutral">{t.items.deck.card_count(count)}</span>}>
        <div data-path={ps('cards')}>
          {cards_errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
          <Field label={t.items.deck.ranks}>
            {() => (
              <div className="deck-pick">
                <Segmented size="sm" label={t.items.deck.ranks} value={rank_mode} onChange={(m) => set_mode('ranks', 'no_ranks', m, ranks)}
                  options={[{ value: 'all', label: t.items.deck.all }, { value: 'only', label: t.items.deck.only }, { value: 'without', label: t.items.deck.without }]} />
                {rank_mode !== 'all' ? (
                  <div className="toggles">
                    {RANK_NAMES.map((r) => (
                      <button key={r} type="button" aria-pressed={ranks.includes(r)} className={ranks.includes(r) ? 'is-on' : ''}
                        onClick={() => toggle('ranks', 'no_ranks', rank_mode, r, ranks)}>{r === '10' ? '10' : r[0]}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Field>
          <Field label={t.items.deck.suits}>
            {() => (
              <div className="deck-pick">
                <Segmented size="sm" label={t.items.deck.suits} value={suit_mode} onChange={(m) => set_mode('suits', 'no_suits', m, suits)}
                  options={[{ value: 'all', label: t.items.deck.all }, { value: 'only', label: t.items.deck.only }, { value: 'without', label: t.items.deck.without }]} />
                {suit_mode !== 'all' ? (
                  <div className="toggles">
                    {SUITS.map((s) => (
                      <button key={s} type="button" aria-pressed={suits.includes(s)} className={`suit suit--${s.toLowerCase()} ${suits.includes(s) ? 'is-on' : ''}`}
                        onClick={() => toggle('suits', 'no_suits', suit_mode, s, suits)}>{({ Spades: '♠', Hearts: '♥', Clubs: '♣', Diamonds: '♦' } as Record<string, string>)[s]} {cat.term('suit', s)}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Field>
          <p className="action__sub">{t.items.deck.every_card}</p>
          <div className="grid-3">
            <Field label={t.items.deck.enhancement}>{(id) => (
              <Select<string> id={id} value={cards.enhancement ?? ''} onChange={(v) => put_cards('enhancement', v || undefined)}
                options={[{ value: '', label: t.common.none }, ...ENHANCEMENTS.map((e) => ({ value: e, label: cat.term('enhancement', e) }))]} />
            )}</Field>
            <Field label={t.items.deck.edition}>{(id) => (
              <Select<string> id={id} value={cards.edition ?? ''} onChange={(v) => put_cards('edition', v || undefined)}
                options={[{ value: '', label: t.common.none }, ...['foil', 'holo', 'polychrome'].map((e) => ({ value: e, label: cat.term('edition', e) }))]} />
            )}</Field>
            <Field label={t.items.deck.seal}>{(id) => (
              <Select<string> id={id} value={cards.seal ?? ''} onChange={(v) => put_cards('seal', v || undefined)}
                options={[{ value: '', label: t.common.none }, ...SEALS.map((e) => ({ value: e, label: cat.term('seal', e) }))]} />
            )}</Field>
          </div>
        </div>
      </Section>
      <TranslationsSection kind="decks" index={index} />
    </>
  );
}

// ------------------------------------------------------------------ blinds
export function BlindForm({ index }: { index: number }) {
  const { t } = useI18n();
  const literals = use_literals();
  const { item, ps, put } = use_item('blinds', index);
  const colour_errors = use_field_issues(ps('colour'));
  const card_errors = use_field_issues(ps('debuff_card'));
  const hand_errors = use_field_issues(ps('debuff_hand'));
  return (
    <>
      <Section title={t.items.sections.card} id="card">
        <IdentityFields kind="blinds" index={index} />
        <div className="flags">
          <Flag kind="blinds" index={index} field="showdown" label={t.items.showdown} help={t.items.showdown_help} def={false} />
        </div>
      </Section>
      <Section title={t.items.sections.look} id="look">
        <PictureSection kind="blinds" index={index} />
        <Field path={ps('colour')} label={t.items.colour} errors={colour_errors}>
          {(id, d) => <ColourInput id={id} describedby={d} value={item?.colour} onChange={(c) => put('colour', c)} />}
        </Field>
      </Section>
      <TextSection kind="blinds" index={index} />
      <Section title={t.items.sections.blind_size} id="size">
        <div className="grid-2">
          <Num kind="blinds" index={index} field="mult" label={t.items.blind_mult} help={t.items.blind_mult_help} def={2} min={0.1} max={100} step={0.5} integer={false} />
          <Num kind="blinds" index={index} field="dollars" label={t.items.blind_dollars} def={5} min={0} max={50} />
        </div>
      </Section>
      <Section title={t.items.sections.antes} id="antes">
        <div className="grid-2">
          <Num kind="blinds" index={index} field="min_ante" label={t.items.min_ante} def={1} min={1} max={39} />
          <Num kind="blinds" index={index} field="max_ante" label={t.items.max_ante} def={10} min={1} max={39} />
        </div>
      </Section>
      <Section title={t.items.sections.debuffs} id="debuffs" tone="#e2574c">
        <Field path={ps('debuff_card')} label={t.items.debuff_card} help={t.items.debuff_card_help} errors={card_errors}>
          {(id, d) => (
            <ExpressionInput id={id} describedby={d} value={item?.debuff_card} onChange={(v) => put('debuff_card', v === '' ? undefined : v)}
              scope={scope_for('blind_card', null, {}, false)} literals={literals} condition />
          )}
        </Field>
        <Field path={ps('debuff_hand')} label={t.items.debuff_hand} help={t.items.debuff_hand_help} errors={hand_errors}>
          {(id, d) => (
            <ExpressionInput id={id} describedby={d} value={item?.debuff_hand} onChange={(v) => put('debuff_hand', v === '' ? undefined : v)}
              scope={scope_for('blind_hand', null, {}, false)} literals={literals} condition />
          )}
        </Field>
      </Section>
      <Section title={t.items.sections.on_set} help={t.items.on_set_help} id="on_set">
        <ActionsEditor actions={item?.on_set} path={ps('on_set')} onChange={(a) => put('on_set', a.length ? a : undefined)}
          c={{ kind: 'blind', trigger: null, config: {}, scope: scope_for('blind', null, {}), literals, only: BLIND_ACTIONS.on_set }} />
      </Section>
      <Section title={t.items.sections.on_hand} help={t.items.on_hand_help} id="on_hand">
        <ActionsEditor actions={item?.on_hand} path={ps('on_hand')} onChange={(a) => put('on_hand', a.length ? a : undefined)}
          c={{ kind: 'blind_hand', trigger: null, config: {}, scope: scope_for('blind_hand', null, {}), literals, only: BLIND_ACTIONS.on_hand }} />
      </Section>
      <TranslationsSection kind="blinds" index={index} />
    </>
  );
}

