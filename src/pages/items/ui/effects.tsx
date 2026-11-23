// A joker's effects: when something happens (the trigger), if a condition
// holds, its actions run; else, others. Effects of the same moment add up.
import { useState } from 'react';
import { use_field_issues } from '@/entities/project';
import { useI18n } from '@/shared/i18n';
import { JOKER_TRIGGERS, moved, scope_for, type Effect } from '@/shared/lib/mod';
import { Button, ExpressionInput, Field, Icon, IconButton, Menu, Select } from '@/shared/ui';
import { ActionsEditor } from './actions';
import type { use_literals } from '../model/item';

export const TRIGGER_GROUPS: { group: 'scoring' | 'discards' | 'round' | 'shop' | 'cards'; triggers: string[] }[] = [
  { group: 'scoring', triggers: ['hand_played', 'card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'score', 'other_joker', 'hand_finished', 'card_destroy', 'hand_not_allowed'] },
  { group: 'discards', triggers: ['discard_start', 'discard'] },
  { group: 'round', triggers: ['blind_selected', 'first_hand_drawn', 'round_end', 'cash_out', 'blind_skipped'] },
  { group: 'shop', triggers: ['shop_reroll', 'shop_exit', 'card_bought', 'card_sold', 'sold', 'pack_opened', 'pack_skipped'] },
  { group: 'cards', triggers: ['consumable_used', 'cards_added', 'cards_destroyed'] },
];

/** the names an expression may read at this trigger, besides self, game and the lists */
function reads(trigger: string): string[] {
  const s = scope_for('joker', trigger, {});
  return [...s.roots.keys()].filter((r) => !['self', 'game', 'joker', 'jokers', 'consumables', 'full_deck', 'deck', 'held'].includes(r));
}

export function EffectsEditor({ effects, onChange, path, config, literals }: {
  effects: unknown; onChange: (e: Effect[]) => void; path: string; config: Record<string, unknown>; literals: ReturnType<typeof use_literals>;
}) {
  const { t } = useI18n();
  const list: Effect[] = Array.isArray(effects) ? effects : [];
  const errors = use_field_issues(path);
  const [closed, setClosed] = useState<Record<number, boolean>>({});
  const add = (on: string) => onChange([...list, on === 'card_destroy' ? { on, if: 'card.face' } : { on, do: [] }]);
  const menu = TRIGGER_GROUPS.flatMap((g) => [
    { group: t.effects.groups[g.group], label: '' },
    ...g.triggers.map((x) => ({ label: t.triggers[x]?.label ?? x, hint: t.triggers[x]?.when, onSelect: () => add(x) })),
  ]);
  return (
    <div className="effects" data-path={path}>
      {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
      {list.map((eff, i) => (
        <EffectCard key={i} n={i + 1} effect={eff} path={`${path}[${i}]`} config={config} literals={literals}
          closed={!!closed[i]} onToggle={() => setClosed((c) => ({ ...c, [i]: !c[i] }))}
          onChange={(x) => onChange(list.map((y, k) => (k === i ? x : y)))}
          onRemove={() => onChange(list.filter((_, k) => k !== i))}
          onDuplicate={() => onChange([...list.slice(0, i + 1), structuredClone(eff), ...list.slice(i + 1)])}
          onUp={i > 0 ? () => onChange(moved(list, i, i - 1)) : undefined}
          onDown={i < list.length - 1 ? () => onChange(moved(list, i, i + 1)) : undefined} />
      ))}
      {list.length < 32 ? (
        <Menu label={t.effects.add} width={360} items={menu}
          trigger={(p) => <Button icon="plus" tone="secondary" {...p}>{t.effects.add}</Button>} />
      ) : null}
    </div>
  );
}

function EffectCard({ n, effect, path, config, literals, closed, onToggle, onChange, onRemove, onDuplicate, onUp, onDown }: {
  n: number; effect: Effect; path: string; config: Record<string, unknown>; literals: ReturnType<typeof use_literals>; closed: boolean;
  onToggle: () => void; onChange: (e: Effect) => void; onRemove: () => void; onDuplicate: () => void; onUp?: () => void; onDown?: () => void;
}) {
  const { t } = useI18n();
  const trigger = String(effect?.on ?? '');
  const known = (JOKER_TRIGGERS as readonly string[]).includes(trigger);
  const scope = scope_for('joker', known ? trigger : null, config);
  const on_errors = use_field_issues(`${path}.on`);
  const if_errors = use_field_issues(`${path}.if`);
  const all = use_field_issues(path, true);
  const own = use_field_issues(path);
  const has_if = effect && 'if' in effect;
  const has_else = effect && 'else' in effect;
  const c = { kind: 'joker' as const, trigger: known ? trigger : null, config, scope, literals };
  const put = (k: keyof Effect, v: unknown) => {
    const next: Record<string, unknown> = { ...effect };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next as unknown as Effect);
  };
  const errs = all.filter((e) => e.level === 'error').length;
  return (
    <article className={['effect', closed ? 'is-closed' : '', errs ? 'has-error' : ''].filter(Boolean).join(' ')} data-path={path}>
      <header className="effect__head">
        <button type="button" className="effect__fold" aria-expanded={!closed} onClick={onToggle} aria-label={t.effects.effect_n(n)}>
          <Icon name={closed ? 'chevron-right' : 'chevron-down'} size={15} />
        </button>
        <span className="effect__n">{n}</span>
        <span className="effect__when">{t.effects.when}</span>
        <div className="effect__trigger" data-path={`${path}.on`}>
          <Select<string> label={t.effects.when} value={trigger}
            onChange={(v) => onChange({ ...effect, on: v } as Effect)}
            options={TRIGGER_GROUPS.map((g) => ({ group: t.effects.groups[g.group], options: g.triggers.map((x) => ({ value: x, label: t.triggers[x]?.label ?? x })) }))} />
        </div>
        <code className="effect__key">{trigger}</code>
        {errs ? <span className="effect__errs"><Icon name="alert" size={14} />{errs}</span> : null}
        <span className="effect__tools">
          <IconButton size="sm" icon="arrow-up" label={t.common.move_up} disabled={!onUp} onClick={onUp} />
          <IconButton size="sm" icon="arrow-down" label={t.common.move_down} disabled={!onDown} onClick={onDown} />
          <IconButton size="sm" icon="copy" label={t.common.duplicate} onClick={onDuplicate} />
          <IconButton size="sm" icon="trash" label={t.common.delete} onClick={onRemove} />
        </span>
      </header>
      {!closed ? (
        <div className="effect__body">
          {known ? (
            <p className="effect__note">
              {t.triggers[trigger]?.when}
              {reads(trigger).length ? <> · {t.effects.reads}: {reads(trigger).map((r) => <code key={r}>{r}</code>)}</> : null}
            </p>
          ) : null}
          {[...own, ...on_errors].map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
          <div className="effect__row">
            <span className="effect__label">{t.effects.if}</span>
            {has_if ? (
              <Field label={t.effects.if} errors={if_errors} path={`${path}.if`} className="effect__cond"
                aside={<IconButton size="sm" icon="x" label={t.effects.remove_condition} onClick={() => {
                  const next: Record<string, unknown> = { ...effect };
                  delete next.if;
                  delete next.else;
                  onChange(next as unknown as Effect);
                }} />}>
                {(id, d) => <ExpressionInput id={id} describedby={d} value={effect.if} onChange={(v) => put('if', v)} scope={scope} values={config} literals={literals} condition />}
              </Field>
            ) : (
              <Button size="sm" tone="ghost" icon="plus" onClick={() => put('if', trigger === 'card_destroy' ? 'card.face' : 'true')}>{t.effects.add_condition}</Button>
            )}
          </div>
          <div className="effect__row">
            <span className="effect__label">{t.effects.do}</span>
            {trigger === 'card_destroy' && !('do' in (effect ?? {})) ? (
              <div className="effect__cond">
                <p className="muted small">{t.effects.card_destroy_note}</p>
                <Button size="sm" tone="ghost" icon="plus" onClick={() => put('do', [])}>{t.effects.add_action}</Button>
              </div>
            ) : (
              <ActionsEditor actions={effect?.do} path={`${path}.do`} c={c} onChange={(a) => put('do', a)} />
            )}
          </div>
          {has_if ? (
            <div className="effect__row">
              <span className="effect__label">{t.effects.else}</span>
              {has_else ? (
                <div className="effect__cond">
                  <ActionsEditor actions={effect.else} path={`${path}.else`} c={c} onChange={(a) => put('else', a)} />
                  <Button size="sm" tone="ghost" icon="x" onClick={() => put('else', undefined)}>{t.effects.remove_else}</Button>
                </div>
              ) : (
                <Button size="sm" tone="ghost" icon="plus" onClick={() => put('else', [])}>{t.effects.add_else}</Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
