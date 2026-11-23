// A list of actions (an effect's do and else, a consumable's use, a voucher's
// redeem, a blind's on_set and on_hand): each is one object with one field,
// edited by what it is. The menu offers only what fits here (or says why not).
import { KeyPicker, useCatalog } from '@/entities/catalog';
import { use_field_issues } from '@/entities/project';
import { ModifiersEditor } from '@/features/run-modifiers';
import { useI18n } from '@/shared/i18n';
import { moved } from '@/shared/lib/mod';
import {
  ACTIONS, CONSUMABLE_SETS, EDITIONS, ENHANCEMENTS, POKER_HANDS, RANK_NAMES, SCORING_ACTIONS, SEALS, SUITS, scope_for,
  type Action, type Scope, type ScopeKind,
} from '@/shared/lib/mod';
import {
  Button, ExpressionInput, Field, Icon, IconButton, Menu, NumberInput, Segmented, Select, TextInput, Toggle, type IconName,
  type LiteralKind, type LiteralOption,
} from '@/shared/ui';
import { use_own_items } from '../model/item';

const ICON: Record<string, IconName> = {
  chips: 'coins', mult: 'plus', xmult: 'x', dollars: 'coins', retrigger: 'refresh', set: 'pencil', message: 'info', level_up: 'arrow-up',
  create: 'sparkle', destroy_self: 'trash', destroy_card: 'trash', hands: 'hand', discards: 'hand', modify_run: 'rules', modify: 'wand',
  add_tag: 'voucher', disable_boss: 'blind', hand_size: 'hand',
};
const TONE: Record<string, string> = { chips: 'chips', mult: 'mult', xmult: 'mult', dollars: 'money', retrigger: 'attention', level_up: 'planet', create: 'tarot' };

export interface ActionsContext {
  kind: ScopeKind;
  trigger: string | null;
  config: Record<string, unknown>;
  scope: Scope;
  literals: (kind: LiteralKind) => LiteralOption[];
  /** a blind's lists: only these actions */
  only?: string[];
}

const PLAYED_HAND = ['hand_played', 'score', 'hand_finished'];

/** whether an action fits here, and if not, why (the engine's words) */
function fits(name: string, c: ActionsContext): string | null {
  if (c.only) return c.only.includes(name) ? null : 'blind';
  const scoring = SCORING_ACTIONS[c.trigger ?? ''] ?? [];
  if (['chips', 'mult', 'xmult'].includes(name) && !scoring.includes(name)) return 'only_scores_in';
  if (name === 'retrigger' && c.trigger !== 'retrigger_scored' && c.trigger !== 'retrigger_held') return 'only_retrigger';
  if ((name === 'set' || name === 'destroy_self') && c.kind !== 'joker') return 'only_joker';
  if (name === 'destroy_card' && c.trigger !== 'discard') return 'only_discard';
  return null;
}

function default_action(name: string, c: ActionsContext): Action {
  const first = Object.keys(c.config)[0];
  switch (name) {
    case 'chips': return { chips: 10 };
    case 'mult': return { mult: 4 };
    case 'xmult': return { xmult: 1.5 };
    case 'dollars': return { dollars: 1 };
    case 'retrigger': return { retrigger: 1 };
    case 'hands': return { hands: 1 };
    case 'discards': return { discards: 1 };
    case 'set': return { set: first ? { [first]: `self.${first} + 1` } : {} };
    case 'message': return { message: 'k_upgrade_ex' };
    case 'level_up': return PLAYED_HAND.includes(c.trigger ?? '') || c.kind === 'consumable' ? { level_up: 1 } : { level_up: { hand: "'Pair'", levels: 1 } };
    case 'create': return { create: { set: 'Tarot' } };
    case 'destroy_self': return { destroy_self: true };
    case 'destroy_card': return { destroy_card: true };
    case 'disable_boss': return { disable_boss: true };
    case 'modify_run': return { modify_run: { hand_size: 1 } };
    case 'add_tag': return { add_tag: 'tag_double' };
    case 'modify': {
      const target = c.kind === 'consumable' ? 'selected' : ['card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'discard', 'card_destroy'].includes(c.trigger ?? '') ? 'card' : 'held';
      return { modify: target === (c.kind === 'consumable' ? 'selected' : 'card') ? { enhancement: 'm_bonus' } : { target, enhancement: 'm_bonus' } };
    }
    default: return { [name]: 1 };
  }
}

export function ActionsEditor({ actions, onChange, path, c, empty }: {
  actions: unknown; onChange: (a: Action[]) => void; path: string; c: ActionsContext; empty?: string;
}) {
  const { t } = useI18n();
  const list: Action[] = Array.isArray(actions) ? actions : [];
  const errors = use_field_issues(path);
  const why = (name: string) => {
    const r = fits(name, c);
    if (!r) return undefined;
    if (r === 'only_scores_in') return t.problems.message({ k: 'only_scores_in', triggers: Object.entries(SCORING_ACTIONS).filter(([, s]) => s.includes(name)).map(([x]) => x) });
    if (r === 'only_retrigger') return t.problems.message({ k: 'only_retrigger' });
    if (r === 'only_joker') return t.problems.message({ k: name === 'set' ? 'only_joker_values' : 'only_joker_destroys' });
    if (r === 'only_discard') return t.problems.message({ k: 'only_discard' });
    return t.effects.not_here;
  };
  const names = c.only ?? [...ACTIONS];
  return (
    <div className="actions" data-path={path}>
      {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
      {list.length ? (
        <ol className="actions__list">
          {list.map((a, i) => (
            <ActionRow key={i} action={a} path={`${path}[${i}]`} c={c}
              onChange={(x) => onChange(list.map((y, k) => (k === i ? x : y)))}
              onRemove={() => onChange(list.filter((_, k) => k !== i))}
              onUp={i > 0 ? () => onChange(moved(list, i, i - 1)) : undefined}
              onDown={i < list.length - 1 ? () => onChange(moved(list, i, i + 1)) : undefined} />
          ))}
        </ol>
      ) : <p className="muted small">{empty ?? t.effects.no_actions}</p>}
      {list.length < 16 ? (
        <Menu label={t.effects.add_action} width={340} items={names.map((n) => ({
          label: t.actions[n]?.label ?? n, icon: ICON[n], hint: why(n) ?? t.actions[n]?.help, disabled: !!why(n),
          onSelect: () => onChange([...list, default_action(n, c)]),
        }))} trigger={(p) => <Button size="sm" tone="ghost" icon="plus" {...p}>{t.effects.add_action}</Button>} />
      ) : null}
    </div>
  );
}

function ActionRow({ action, path, c, onChange, onRemove, onUp, onDown }: {
  action: Action; path: string; c: ActionsContext; onChange: (a: Action) => void; onRemove: () => void; onUp?: () => void; onDown?: () => void;
}) {
  const { t } = useI18n();
  const entries = action && typeof action === 'object' && !Array.isArray(action) ? Object.entries(action) : [];
  const [name, arg] = entries.length === 1 ? entries[0] : [entries[0]?.[0] ?? '?', entries[0]?.[1]];
  const issues = use_field_issues(`${path}.${name}`, true);
  const own = use_field_issues(path);
  const set = (v: unknown) => onChange({ [name]: v });
  return (
    <li className={['action', TONE[name] ? `action--${TONE[name]}` : '', issues.some((e) => e.level === 'error') || own.length ? 'has-error' : ''].filter(Boolean).join(' ')} data-path={`${path}.${name}`}>
      <div className="action__head">
        <span className="action__icon"><Icon name={ICON[name] ?? 'dot'} size={15} /></span>
        <span className="action__label" title={t.actions[name]?.help}>{t.actions[name]?.label ?? name}</span>
        <code className="action__key">{name}</code>
        <span className="action__tools">
          <IconButton size="sm" icon="arrow-up" label={t.common.move_up} disabled={!onUp} onClick={onUp} />
          <IconButton size="sm" icon="arrow-down" label={t.common.move_down} disabled={!onDown} onClick={onDown} />
          <IconButton size="sm" icon="trash" label={t.common.remove} onClick={onRemove} />
        </span>
      </div>
      <div className="action__body">
        <ActionBody name={name} arg={arg} path={`${path}.${name}`} c={c} set={set} />
        {[...own, ...issues].map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
      </div>
    </li>
  );
}

function ActionBody({ name, arg, path, c, set }: { name: string; arg: any; path: string; c: ActionsContext; set: (v: unknown) => void }) {
  const { t } = useI18n();
  const cat = useCatalog();
  const own_jokers = use_own_items('jokers');
  const own_cons = use_own_items('consumables');
  const af = t.action_fields;
  const expr = (value: unknown, onChange: (v: unknown) => void, label: string, scope = c.scope, condition = false) => (
    <ExpressionInput value={value as string} onChange={onChange} scope={scope} values={c.config} literals={c.literals} label={label} multiline={false} condition={condition} />
  );
  switch (name) {
    case 'chips': case 'mult': case 'xmult': case 'dollars': case 'hands': case 'discards':
      return <div className="action__line"><span className="action__sign">{name === 'xmult' ? '×' : name === 'dollars' ? '$' : '+'}</span>{expr(arg, set, af.amount)}</div>;
    case 'retrigger':
      return <div className="action__line"><span className="action__sign">×</span>{expr(arg, set, af.times)}</div>;
    case 'set': {
      const values: Record<string, unknown> = arg && typeof arg === 'object' ? arg : {};
      const names = Object.keys(c.config);
      if (!names.length) return <p className="muted small">{af.no_values}</p>;
      return (
        <div className="action__set">
          {Object.entries(values).map(([k, v]) => (
            <div key={k} className="action__line">
              <Select<string> label={af.add_value} value={k} options={names.map((n) => ({ value: n, label: `self.${n}` }))}
                onChange={(n) => { const next: Record<string, unknown> = {}; for (const [kk, vv] of Object.entries(values)) next[kk === k ? n : kk] = vv; set(next); }} />
              <span className="action__sign">=</span>
              {expr(v, (x) => set({ ...values, [k]: x }), `self.${k}`)}
              <IconButton size="sm" icon="x" label={t.common.remove} onClick={() => { const next = { ...values }; delete next[k]; set(next); }} />
            </div>
          ))}
          {names.some((n) => !(n in values)) ? (
            <Menu label={af.add_value} items={names.filter((n) => !(n in values)).map((n) => ({ label: `self.${n}`, onSelect: () => set({ ...values, [n]: `self.${n}` }) }))}
              trigger={(p) => <Button size="sm" tone="ghost" icon="plus" {...p}>{af.add_value}</Button>} />
          ) : null}
        </div>
      );
    }
    case 'message': {
      const is_game = typeof arg === 'string' && cat.messages.some((m) => m.key === arg);
      return (
        <div className="action__line">
          <Segmented size="sm" label={t.actions.message.label} value={is_game ? 'game' : 'own'}
            options={[{ value: 'game', label: af.message_game }, { value: 'own', label: af.message_own }]}
            onChange={(m) => set(m === 'game' ? 'k_upgrade_ex' : (typeof arg === 'string' && !is_game ? arg : 'Nice!'))} />
          {is_game ? (
            <Select<string> label={t.actions.message.label} value={arg} onChange={set}
              options={cat.messages.map((m) => ({ value: m.key, label: `${m.text}  (${m.key})` }))} />
          ) : (
            <TextInput aria-label={t.actions.message.label} value={typeof arg === 'string' ? arg : ''} maxLength={40} placeholder={af.message_placeholder} onChange={set} />
          )}
        </div>
      );
    }
    case 'level_up': {
      const named = arg && typeof arg === 'object' && !Array.isArray(arg);
      const hand = named && typeof arg.hand === 'string' ? arg.hand.replace(/^'(.*)'$/, '$1') : '';
      const is_literal = named && typeof arg.hand === 'string' && /^'[^']*'$/.test(arg.hand);
      return (
        <div className="action__set">
          <div className="action__line">
            <Segmented size="sm" label={af.which_hand} value={named ? 'named' : 'played'}
              options={[{ value: 'played', label: af.played_hand }, { value: 'named', label: af.named_hand }]}
              onChange={(m) => set(m === 'played' ? (named ? arg.levels ?? 1 : arg) : { hand: "'Pair'", levels: named ? arg.levels : arg ?? 1 })} />
            {named ? (is_literal || !arg.hand ? (
              <Select<string> label={af.which_hand} value={hand} onChange={(h) => set({ ...arg, hand: `'${h}'` })}
                options={POKER_HANDS.map((h) => ({ value: h, label: cat.hand_name(h) }))} />
            ) : expr(arg.hand, (x) => set({ ...arg, hand: x }), af.which_hand)) : null}
          </div>
          <div className="action__line">
            <span className="action__sign">{af.levels}</span>
            {expr(named ? arg.levels ?? 1 : arg, (x) => set(named ? { ...arg, levels: x } : x), af.levels)}
          </div>
        </div>
      );
    }
    case 'create': {
      const a = arg && typeof arg === 'object' ? arg : {};
      const set_of = String(a.set ?? 'Tarot');
      const kinds = set_of === 'Joker' ? ['jokers' as const] : set_of === 'Tarot' ? ['tarots' as const] : set_of === 'Planet' ? ['planets' as const] : ['spectrals' as const];
      const extra = set_of === 'Joker' ? own_jokers : own_cons.filter((x) => x.set === set_of);
      const put = (k: string, v: unknown) => { const n = { ...a }; if (v === undefined || v === '') delete n[k]; else n[k] = v; set(n); };
      return (
        <div className="action__grid">
          <Field label={af.create_set}>{(id) => (
            <Select<string> id={id} value={set_of} onChange={(s) => { const n = { ...a, set: s }; delete n.key; if (s !== 'Joker') delete n.rarity; set(n); }}
              options={[...CONSUMABLE_SETS, 'Joker'].map((s) => ({ value: s, label: s === 'Joker' ? t.kinds.jokers.one : t.items.sets[s as 'Tarot'] }))} />
          )}</Field>
          <Field label={af.create_key}>{(id) => (
            <KeyPicker id={id} label={af.create_key} value={a.key} kinds={kinds} extra={extra} allow_none none_label={af.any_card} onChange={(k) => put('key', k)} compact />
          )}</Field>
          {set_of === 'Joker' ? (
            <Field label={af.rarity}>{(id) => (
              <Select<string> id={id} value={a.rarity ? String(a.rarity) : ''} onChange={(r) => put('rarity', r ? Number(r) : undefined)}
                options={[{ value: '', label: af.any_rarity }, ...t.items.rarities.map((r, i) => ({ value: String(i + 1), label: r }))]} />
            )}</Field>
          ) : null}
          <Field label={af.edition}>{(id) => (
            <Select<string> id={id} value={a.edition ?? ''} onChange={(e) => put('edition', e || undefined)}
              options={[{ value: '', label: af.no_edition }, ...EDITIONS.map((e) => ({ value: e, label: cat.term('edition', e) }))]} />
          )}</Field>
        </div>
      );
    }
    case 'destroy_self': case 'destroy_card': case 'disable_boss':
      return <p className="muted small">{t.actions[name]?.help}</p>;
    case 'modify_run':
      return <ModifiersEditor value={arg} onChange={(v) => set(v ?? {})} context="action" path={path} scope={c.scope} values={c.config} literals={c.literals} />;
    case 'add_tag':
      return <KeyPicker label={af.tag} value={typeof arg === 'string' ? arg : undefined} kinds={['tags']} onChange={(k) => set(k ?? 'tag_double')} compact />;
    case 'modify':
      return <ModifyBody arg={arg && typeof arg === 'object' ? arg : {}} set={set} c={c} />;
    case 'hand_size':
      return <div className="action__line"><span className="action__sign">±</span><NumberInput label={af.blind_hand_size} value={typeof arg === 'number' ? arg : 0} integer min={-10} max={10} onChange={(n) => set(n ?? 0)} /></div>;
    default:
      return <code className="muted">{JSON.stringify(arg)}</code>;
  }
}

function ModifyBody({ arg, set, c }: { arg: Record<string, any>; set: (v: unknown) => void; c: ActionsContext }) {
  const { t } = useI18n();
  const cat = useCatalog();
  const af = t.action_fields;
  const def_target = c.kind === 'consumable' ? 'selected' : 'card';
  const target = String(arg.target ?? def_target);
  const put = (k: string, v: unknown) => { const n = { ...arg }; if (v === undefined || v === '') delete n[k]; else n[k] = v; set(n); };
  const where_scope = scope_for('modify', c.trigger, c.config);
  const card_ok = ['card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'discard', 'card_destroy'].includes(c.trigger ?? '');
  const hand_ok = ['hand_played', 'card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'score', 'other_joker', 'hand_finished', 'card_destroy', 'hand_not_allowed'].includes(c.trigger ?? '');
  const targets = (['card', 'scoring', 'played', 'held', 'selected'] as const).filter((x) =>
    (x !== 'card' || card_ok) && ((x !== 'scoring' && x !== 'played') || hand_ok) && (x !== 'selected' || c.kind === 'consumable') || x === target);
  const sel = (k: 'enhancement' | 'seal' | 'edition' | 'suit', options: readonly string[], none = true) => (
    <Field label={af[k]}>{(id) => (
      <Select<string> id={id} value={arg[k] ?? ''} onChange={(v) => put(k, v || undefined)}
        options={[{ value: '', label: af.unchanged }, ...(none ? [{ value: 'none', label: af.remove_it }] : []), ...options.map((o) => ({ value: o, label: cat.term(k, o) }))]} />
    )}</Field>
  );
  return (
    <div className="action__set">
      <div className="action__grid">
        <Field label={af.target}>{(id) => (
          <Select<string> id={id} value={target} onChange={(v) => put('target', v === def_target ? undefined : v)}
            options={targets.map((x) => ({ value: x, label: af.targets[x] }))} />
        )}</Field>
        <Field label={af.where} help={af.where_help} className="span-2">{() => (
          <ExpressionInput value={arg.where} onChange={(v) => put('where', v === '' ? undefined : v)} scope={where_scope} values={c.config}
            literals={c.literals} label={af.where} multiline={false} condition />
        )}</Field>
      </div>
      <p className="action__sub">{af.changes}</p>
      <div className="action__grid">
        {sel('enhancement', ENHANCEMENTS)}
        {sel('seal', SEALS)}
        {sel('edition', ['foil', 'holo', 'polychrome'])}
        {sel('suit', SUITS, false)}
        <Field label={af.rank}>{(id) => (
          <Select<string> id={id} value={arg.rank ?? ''} onChange={(v) => put('rank', v || undefined)}
            options={[{ value: '', label: af.unchanged }, { value: 'up', label: af.rank_up }, { value: 'down', label: af.rank_down }, ...RANK_NAMES.map((r) => ({ value: r, label: cat.term('rank', r) }))]} />
        )}</Field>
        <Field label={af.bonus_chips}>{() => (
          <ExpressionInput value={arg.chips} onChange={(v) => put('chips', v === '' ? undefined : v)} scope={where_scope} values={c.config} literals={c.literals} label={af.bonus_chips} multiline={false} />
        )}</Field>
        {target === 'selected' ? (
          <Field label={af.destroy}>{() => <Toggle checked={!!arg.destroy} onChange={(v) => put('destroy', v || undefined)} label={af.destroy} />}</Field>
        ) : null}
      </div>
    </div>
  );
}
