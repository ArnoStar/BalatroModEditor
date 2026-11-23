// The mod itself: its name, id (whether it is free in the registry), version,
// author, description and tags, their translations, the house rules every run
// with it plays by, creative mode, and what it holds.
import { useEffect, useState } from 'react';
import { ItemThumb } from '@/entities/catalog';
import { use_field_issues, useProject } from '@/entities/project';
import { use_registry } from '@/entities/registry';
import { ModifiersEditor } from '@/features/run-modifiers';
import { GAME_LANGUAGES, useI18n } from '@/shared/i18n';
import { slug } from '@/shared/lib';
import { bump, KINDS, rename_mod_id, type AnyItem } from '@/shared/lib/mod';
import {
  Button, Field, Icon, IconButton, KIND_ICON, KIND_TONE, LinkButton, Menu, Section, TagsInput, TextArea, TextInput, Toggle,
} from '@/shared/ui';

function IdField() {
  const { t } = useI18n();
  const { pkg, change } = useProject();
  const [draft, setDraft] = useState(pkg.id);
  useEffect(() => setDraft(pkg.id), [pkg.id]);
  const errors = use_field_issues('id');
  const state = use_registry(pkg.id);
  const commit = () => { if (draft !== pkg.id) change((p) => rename_mod_id(p, draft), 'id'); };
  const status = state.k === 'free' ? { tone: 'ok', text: t.overview.id_free } : state.k === 'yours' ? { tone: 'ok', text: t.overview.id_yours(state.mod.version) }
    : state.k === 'taken' ? { tone: 'warning', text: t.overview.id_taken } : state.k === 'official' ? { tone: 'warning', text: t.overview.id_official } : null;
  return (
    <Field path="id" label={t.overview.id} help={t.overview.id_help} errors={errors}
      aside={status ? <span className={`id-state id-state--${status.tone}`}><Icon name={status.tone === 'ok' ? 'check' : 'alert'} size={13} />{status.text}</span> : null}>
      {(id, d) => (
        <TextInput id={id} aria-describedby={d} mono maxLength={32} value={draft}
          onChange={(v) => setDraft(v.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
          onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      )}
    </Field>
  );
}

export function OverviewPage() {
  const { t } = useI18n();
  const { pkg, set, project } = useProject();
  const name_errors = use_field_issues('name');
  const version_errors = use_field_issues('version');
  const author_errors = use_field_issues('author');
  const description_errors = use_field_issues('description');
  const tags_errors = use_field_issues('tags', true);
  const loc_errors = use_field_issues('loc', true);
  const loc = pkg.loc ?? {};
  const langs = Object.keys(loc);
  const missing = GAME_LANGUAGES.filter((l) => l.key !== 'en-us' && !langs.includes(l.key));
  const set_loc = (lang: string, v: { name?: string; description?: string } | undefined) => {
    const next = { ...loc };
    if (v === undefined) delete next[lang];
    else next[lang] = v;
    set(['loc'], Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="page page--overview">
      <header className="page__head">
        <div>
          <h1 className="page__title"><Icon name="home" size={22} />{pkg.name || t.overview.title}</h1>
          <p className="page__lead">{pkg.description ? pkg.description.slice(0, 160) : KINDS.some((k) => (pkg[k] ?? []).length) ? KINDS.filter((k) => (pkg[k] ?? []).length).map((k) => t.kinds[k].count((pkg[k] ?? []).length)).join(' · ') : t.overview.empty}</p>
        </div>
      </header>

      <Section title={t.overview.identity} id="identity">
        <div className="grid-2">
          <Field path="name" label={t.overview.name} help={t.overview.name_help} errors={name_errors}>
            {(id, d) => <TextInput id={id} aria-describedby={d} value={pkg.name ?? ''} maxLength={60} onChange={(v) => set(['name'], v)} />}
          </Field>
          <IdField />
          <Field path="version" label={t.overview.version} help={t.overview.version_help} errors={version_errors}
            aside={<span className="bump">
              {(['patch', 'minor', 'major'] as const).map((part) => (
                <button key={part} type="button" className="chip chip--button" onClick={() => set(['version'], bump(pkg.version, part))}>+ {t.overview.bump[part]}</button>
              ))}
            </span>}>
            {(id, d) => <TextInput id={id} aria-describedby={d} mono value={pkg.version ?? ''} maxLength={20} onChange={(v) => set(['version'], v)} />}
          </Field>
          <Field path="author" label={t.overview.author} errors={author_errors}>
            {(id, d) => <TextInput id={id} aria-describedby={d} value={pkg.author ?? ''} maxLength={60} placeholder={t.overview.author_placeholder} onChange={(v) => set(['author'], v || undefined)} />}
          </Field>
        </div>
        <Field path="description" label={t.overview.description} errors={description_errors}>
          {(id, d) => <TextArea id={id} aria-describedby={d} rows={4} maxLength={2000} value={pkg.description ?? ''} placeholder={t.overview.description_placeholder} onChange={(v) => set(['description'], v || undefined)} />}
        </Field>
        <Field path="tags" label={t.overview.tags} help={t.overview.tags_help} errors={tags_errors}>
          {(id, d) => (
            <TagsInput id={id} describedby={d} value={pkg.tags ?? []} placeholder={t.overview.tag_placeholder}
              normalize={(s) => slug(s, 24, 'tag').replace(/_/g, '-')} onChange={(v) => set(['tags'], v.length ? v : undefined)} />
          )}
        </Field>
      </Section>

      <Section title={t.overview.translations} help={t.overview.translations_help} id="loc"
        actions={missing.length ? (
          <Menu label={t.overview.add_language} width={260} align="end" items={missing.map((l) => ({
            label: l.name, hint: l.key, onSelect: () => set_loc(l.key, { name: pkg.name, description: pkg.description }),
          }))} trigger={(p) => <Button size="sm" tone="ghost" icon="plus" {...p}>{t.overview.add_language}</Button>} />
        ) : null}>
        <div data-path="loc">
          {loc_errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
          {langs.map((lang) => (
            <div key={lang} className="lang-block">
              <div className="lang-block__head">
                <strong>{GAME_LANGUAGES.find((l) => l.key === lang)?.name ?? lang}</strong> <code>{lang}</code>
                <IconButton size="sm" icon="trash" label={t.translations.remove_language} onClick={() => set_loc(lang, undefined)} />
              </div>
              <div className="grid-2">
                <Field label={t.overview.name}>{(id) => <TextInput id={id} value={loc[lang]?.name ?? ''} maxLength={60} onChange={(v) => set_loc(lang, { ...loc[lang], name: v || undefined })} />}</Field>
                <Field label={t.overview.description}>{(id) => <TextArea id={id} rows={2} value={loc[lang]?.description ?? ''} onChange={(v) => set_loc(lang, { ...loc[lang], description: v || undefined })} />}</Field>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t.overview.rules} help={t.overview.rules_help} id="rules">
        <ModifiersEditor value={pkg.rules} onChange={(v) => set(['rules'], v)} context="start" path="rules" />
      </Section>

      <Section title={t.overview.creative} id="creative">
        <div data-path="creative" className="flag">
          <Toggle checked={!!pkg.creative} onChange={(v) => set(['creative'], v || undefined)} label={t.overview.creative} />
          <p className="field__help">{t.overview.creative_help}</p>
        </div>
      </Section>

      <Section title={t.overview.contents} id="contents">
        <div className="contents">
          {KINDS.map((kind) => {
            const list = (pkg[kind] ?? []) as AnyItem[];
            return (
              <LinkButton key={kind} to={`/p/${project.id}/${kind}`} tone="ghost" className="contents__kind" style={{ '--tone': KIND_TONE[kind] } as React.CSSProperties}>
                <span className="contents__head"><Icon name={KIND_ICON[kind]} size={18} /><b>{list.length}</b> {t.kinds[kind].many}</span>
                <span className="contents__thumbs">
                  {list.slice(0, 6).map((it, i) => <ItemThumb key={i} kind={kind} item={it} assets={pkg.assets} scale={0.4} />)}
                </span>
              </LinkButton>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
