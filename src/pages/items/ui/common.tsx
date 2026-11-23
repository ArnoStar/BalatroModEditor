// What every item has: its key and name, its description (text and values),
// its own values (config), and its translations.
import { useEffect, useState } from 'react';
import { use_field_issues, useProject } from '@/entities/project';
import { useCatalog } from '@/entities/catalog';
import { GAME_LANGUAGES, useI18n } from '@/shared/i18n';
import {
  full_key, KEY_PATTERN, rename_item_key, scope_for, type ItemKind, type ScopeKind, type Value,
} from '@/shared/lib/mod';
import {
  Button, ExpressionInput, Field, IconButton, MarkupInput, Menu, NumberInput, Section, Select, TextInput, Toggle, type MenuItem,
} from '@/shared/ui';
import { rename_config, use_item, use_literals } from '../model/item';

const SCOPE_KIND: Record<ItemKind, ScopeKind> = { jokers: 'joker', consumables: 'consumable', vouchers: 'voucher', decks: 'deck', blinds: 'blind' };
export const scope_kind = (k: ItemKind) => SCOPE_KIND[k];

/** a value typed here and kept once it is done (on Enter or leaving the field): renames follow it */
function useDraft(value: string, commit: (v: string) => void) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return {
    value: draft,
    onChange: setDraft,
    onBlur: () => { if (draft !== value) commit(draft); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDraft(value); },
  };
}

export function IdentityFields({ kind, index }: { kind: ItemKind; index: number }) {
  const { t } = useI18n();
  const { pkg, change } = useProject();
  const { item, ps, put } = use_item(kind, index);
  const key_errors = use_field_issues(ps('key'));
  const name_errors = use_field_issues(ps('name'));
  const key = useDraft(String(item?.key ?? ''), (v) => change((p) => rename_item_key(p, kind, index, v.trim()), `key:${kind}:${index}`));
  return (
    <div className="grid-2">
      <Field path={ps('name')} label={t.items.name} help={t.items.name_help} errors={name_errors}>
        {(id, d) => <TextInput id={id} aria-describedby={d} value={String(item?.name ?? '')} maxLength={40} onChange={(v) => put('name', v)} />}
      </Field>
      <Field path={ps('key')} label={t.items.key} help={t.items.key_help(full_key(pkg.id, kind, key.value || '…'))} errors={key_errors}>
        {(id, d) => <TextInput id={id} aria-describedby={d} mono maxLength={32} pattern={KEY_PATTERN} {...key} onChange={(v) => key.onChange(v.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />}
      </Field>
    </div>
  );
}

/** the description: its lines in the game's markup, and the values they show */
export function TextSection({ kind, index }: { kind: ItemKind; index: number }) {
  const { t } = useI18n();
  const cat = useCatalog();
  const literals = use_literals();
  const { item, ps, put } = use_item(kind, index);
  const lines: string[] = Array.isArray(item?.text) ? item.text : [];
  const vars: unknown[] = Array.isArray(item?.vars) ? item.vars : [];
  const config = (item?.config ?? {}) as Record<string, unknown>;
  const text_errors = use_field_issues(ps('text'), true);
  const vars_errors = use_field_issues(ps('vars'));
  const scope = scope_for(scope_kind(kind), null, config, false);
  const set_vars = (v: unknown[]) => put('vars', v.length ? v : undefined);
  const tips = (insert: (key: string) => void): MenuItem[] => [
    ...cat.items('enhancements').map((x) => ({ label: x.name, hint: x.key, onSelect: () => insert(x.key) })),
    ...cat.items('tags').slice(0, 30).map((x) => ({ label: x.name, hint: x.key, onSelect: () => insert(x.key) })),
    ...cat.items('vouchers').slice(0, 40).map((x) => ({ label: x.name, hint: x.key, onSelect: () => insert(x.key) })),
    ...cat.items('jokers').slice(0, 60).map((x) => ({ label: x.name, hint: x.key, onSelect: () => insert(x.key) })),
  ];
  return (
    <Section title={t.items.sections.text} help={t.items.text_help} id="text">
      <Field path={ps('text')} label={t.items.text} errors={text_errors}>
        {(id, d) => (
          <MarkupInput id={id} describedby={d} lines={lines.length ? lines : ['']} vars={vars.map(String)}
            tooltip_items={tips} onChange={(l) => put('text', l.length === 1 && l[0] === '' ? [] : l)} />
        )}
      </Field>
      <Field path={ps('vars')} label={t.items.vars} help={t.items.vars_help} errors={vars_errors}>
        {() => (
          <div className="vars">
            {vars.map((v, i) => (
              <VarRow key={i} n={i + 1} path={ps('vars', i)} value={v} scope={scope} config={config} literals={literals}
                onChange={(x) => set_vars(vars.map((y, k) => (k === i ? x : y)))}
                onRemove={() => set_vars(vars.filter((_, k) => k !== i))} />
            ))}
            {vars.length < 8 ? (
              <Button size="sm" tone="ghost" icon="plus" onClick={() => set_vars([...vars, Object.keys(config)[vars.length] ? `self.${Object.keys(config)[vars.length]}` : 1])}>
                {t.items.add_var}
              </Button>
            ) : null}
          </div>
        )}
      </Field>
    </Section>
  );
}

function VarRow({ n, path, value, scope, config, literals, onChange, onRemove }: {
  n: number; path: string; value: unknown; scope: ReturnType<typeof scope_for>; config: Record<string, unknown>;
  literals: ReturnType<typeof use_literals>; onChange: (v: string | number | boolean) => void; onRemove: () => void;
}) {
  const { t } = useI18n();
  const errors = use_field_issues(path);
  return (
    <div className="var-row" data-path={path}>
      <code className="var-row__n">#{n}#</code>
      <div className="var-row__expr">
        <ExpressionInput value={value as string} onChange={onChange} scope={scope} values={config} literals={literals} multiline={false} label={`#${n}#`} />
        {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
      </div>
      <IconButton size="sm" icon="trash" label={t.common.remove} onClick={onRemove} />
    </div>
  );
}

type ValueType = 'number' | 'string' | 'boolean';
const type_of = (v: Value): ValueType => (typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string');

/** the item's own values (config): what self.<name> reads, each copy of a joker its own */
export function ConfigSection({ kind, index }: { kind: ItemKind; index: number }) {
  const { t } = useI18n();
  const { item, ps, put, edit } = use_item(kind, index);
  const config = (item?.config ?? {}) as Record<string, Value>;
  const errors = use_field_issues(ps('config'));
  const entries = Object.entries(config);
  const set_value = (k: string, v: Value) => put('config', { ...config, [k]: v });
  const remove = (k: string) => { const next = { ...config }; delete next[k]; put('config', Object.keys(next).length ? next : undefined); };
  const add = () => {
    let n = entries.length + 1;
    while (`value${n}` in config) n++;
    put('config', { ...config, [`value${n}`]: 1 });
  };
  return (
    <Section title={t.items.sections.values} help={t.items.config_help} id="values">
      <div className="config" data-path={ps('config')}>
        {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
        {entries.length ? (
          <div className="config__head" aria-hidden><span>{t.items.config_name}</span><span>{t.items.config_types.number}</span><span>{t.items.config_value}</span><span /></div>
        ) : null}
        {entries.map(([k, v]) => (
          <ConfigRow key={k} name={k} value={v} path={ps('config', k)}
            onRename={(to) => { if (to && to !== k && !(to in config)) edit((it) => rename_config(it, k, to), `config:${k}`); }}
            onType={(ty) => set_value(k, ty === 'number' ? 0 : ty === 'boolean' ? false : '')}
            onValue={(x) => set_value(k, x)} onRemove={() => remove(k)} />
        ))}
        <Button size="sm" tone="ghost" icon="plus" onClick={add} disabled={entries.length >= 32}>{t.items.add_value}</Button>
        {entries.length ? <p className="muted small">{t.items.rename_note}</p> : null}
      </div>
    </Section>
  );
}

function ConfigRow({ name, value, path, onRename, onType, onValue, onRemove }: {
  name: string; value: Value; path: string; onRename: (to: string) => void; onType: (t: ValueType) => void; onValue: (v: Value) => void; onRemove: () => void;
}) {
  const { t } = useI18n();
  const errors = use_field_issues(path);
  const draft = useDraft(name, (v) => onRename(v.trim()));
  const ty = type_of(value);
  return (
    <div className={`config__row ${errors.length ? 'has-problem' : ''}`} data-path={path}>
      <TextInput mono aria-label={t.items.config_name} maxLength={32} {...draft} onChange={(v) => draft.onChange(v.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
      <Select<ValueType> label={t.items.config_types.number} value={ty} onChange={onType}
        options={(['number', 'string', 'boolean'] as const).map((x) => ({ value: x, label: t.items.config_types[x] }))} />
      {ty === 'number' ? <NumberInput label={t.items.config_value} value={value as number} step={1} onChange={(n) => onValue(n ?? 0)} />
        : ty === 'boolean' ? <Toggle checked={value as boolean} onChange={onValue} label={String(value)} />
          : <TextInput aria-label={t.items.config_value} value={value as string} maxLength={60} onChange={onValue} />}
      <IconButton size="sm" icon="trash" label={t.common.remove} onClick={onRemove} />
      {errors.length ? <p className="config__problem">{errors.map((e) => e.text).join(' · ')}</p> : null}
    </div>
  );
}

/** the item's name and text in the game's other languages */
export function TranslationsSection({ kind, index }: { kind: ItemKind; index: number }) {
  const { t } = useI18n();
  const { item, ps, put } = use_item(kind, index);
  const loc = (item?.loc ?? {}) as Record<string, { name?: string; text?: string[] }>;
  const langs = Object.keys(loc);
  const vars: unknown[] = Array.isArray(item?.vars) ? item.vars : [];
  const set_lang = (lang: string, v: { name?: string; text?: string[] } | undefined) => {
    const next = { ...loc };
    if (v === undefined) delete next[lang];
    else next[lang] = v;
    put('loc', Object.keys(next).length ? next : undefined);
  };
  const missing = GAME_LANGUAGES.filter((l) => l.key !== 'en-us' && !langs.includes(l.key));
  return (
    <Section title={t.items.sections.translations} id="translations"
      actions={missing.length ? (
        <Menu label={t.overview.add_language} width={260} items={missing.map((l) => ({
          label: l.name, hint: l.key, onSelect: () => set_lang(l.key, { name: item?.name ?? '', text: [...(item?.text ?? [])] }),
        }))} trigger={(p) => <Button size="sm" tone="ghost" icon="plus" {...p}>{t.overview.add_language}</Button>} />
      ) : null}>
      {langs.length ? langs.map((lang) => (
        <LangBlock key={lang} lang={lang} value={loc[lang]} vars={vars.map(String)} path={ps('loc', lang)} onChange={(v) => set_lang(lang, v)} />
      )) : <p className="muted small">{t.translations.lead}</p>}
    </Section>
  );
}

function LangBlock({ lang, value, vars, path, onChange }: {
  lang: string; value: { name?: string; text?: string[] }; vars: string[]; path: string; onChange: (v: { name?: string; text?: string[] } | undefined) => void;
}) {
  const { t } = useI18n();
  const errors = use_field_issues(path, true);
  const name = GAME_LANGUAGES.find((l) => l.key === lang)?.name ?? lang;
  return (
    <div className="lang-block" data-path={path}>
      <div className="lang-block__head">
        <strong>{name}</strong> <code>{lang}</code>
        <IconButton size="sm" icon="trash" label={t.translations.remove_language} onClick={() => onChange(undefined)} />
      </div>
      {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
      <Field label={t.items.name}>
        {(id) => <TextInput id={id} value={value?.name ?? ''} maxLength={40} onChange={(v) => onChange({ ...value, name: v || undefined })} />}
      </Field>
      <Field label={t.items.text}>
        {(id) => <MarkupInput id={id} lines={value?.text?.length ? value.text : ['']} vars={vars} onChange={(l) => onChange({ ...value, text: l.length === 1 && !l[0] ? undefined : l })} />}
      </Field>
    </div>
  );
}
