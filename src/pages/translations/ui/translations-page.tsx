// Every text of the mod in one language at a time, next to the English: the
// mod's name and description, and each item's name and text.
import { useMemo, useState } from 'react';
import { useProject } from '@/entities/project';
import { CardPreview } from '@/widgets/card-preview';
import { GAME_LANGUAGES, useI18n } from '@/shared/i18n';
import { KINDS, set_in, type AnyItem, type ModPackage } from '@/shared/lib/mod';
import { Button, GameText, Icon, KIND_ICON, MarkupInput, Select, TextArea, TextInput, Toggle, useConfirm } from '@/shared/ui';

interface Row { id: string; kind: string; index?: number; label: string; en_name: string; en_text: string[]; name?: string; text?: string[]; is_mod?: boolean; path: (string | number)[]; vars: string[] }

export function TranslationsPage() {
  const { t, game_lang } = useI18n();
  const { pkg, change } = useProject();
  const confirm = useConfirm();
  const used = useMemo(() => {
    const s = new Set<string>(Object.keys(pkg.loc ?? {}));
    for (const k of KINDS) for (const it of (pkg[k] ?? []) as AnyItem[]) for (const l of Object.keys(it?.loc ?? {})) s.add(l);
    return s;
  }, [pkg]);
  const [lang, setLang] = useState(() => (game_lang !== 'en-us' ? game_lang : [...used][0] ?? 'ru'));
  const [missing_only, setMissingOnly] = useState(false);
  const [previews, setPreviews] = useState(false);
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [{
      id: 'mod', kind: 'mod', label: t.translations.the_mod, en_name: pkg.name, en_text: pkg.description ? [pkg.description] : [],
      name: pkg.loc?.[lang]?.name, text: pkg.loc?.[lang]?.description !== undefined ? [pkg.loc[lang].description!] : undefined, is_mod: true, path: ['loc', lang], vars: [],
    }];
    for (const k of KINDS) ((pkg[k] ?? []) as AnyItem[]).forEach((it, i) => {
      out.push({
        id: `${k}:${i}`, kind: k, index: i, label: it?.name || it?.key, en_name: it?.name ?? '', en_text: it?.text ?? [],
        name: it?.loc?.[lang]?.name, text: it?.loc?.[lang]?.text, path: [k, i, 'loc', lang], vars: (it?.vars ?? []).map(String),
      });
    });
    return out;
  }, [pkg, lang, t]);
  const done = rows.filter((r) => r.name && (r.text?.length || !r.en_text.length)).length;
  const shown = missing_only ? rows.filter((r) => !r.name || (r.en_text.length && !r.text?.length)) : rows;
  const put = (r: Row, field: 'name' | 'text', v: string | string[] | undefined) => {
    change((p) => {
      const cur = (r.path.reduce<any>((x, s) => x?.[s], p) ?? {}) as Record<string, unknown>;
      const key = r.is_mod && field === 'text' ? 'description' : field;
      const val = r.is_mod && field === 'text' ? (Array.isArray(v) ? v.join('\n') : v) : v;
      const next: Record<string, unknown> = { ...cur, [key]: val };
      if (val === undefined || val === '' || (Array.isArray(val) && !val.length)) delete next[key];
      return set_in(p, r.path, Object.keys(next).length ? next : undefined) as ModPackage;
    }, `loc:${r.id}:${field}`);
  };
  const copy_source = (r: Row) => { put(r, 'name', r.en_name); if (r.en_text.length) put(r, 'text', r.is_mod ? r.en_text.join('\n') : [...r.en_text]); };
  const remove_language = async () => {
    const name = GAME_LANGUAGES.find((l) => l.key === lang)?.name ?? lang;
    if (!(await confirm(t.translations.remove_confirm(name)))) return;
    change((p) => {
      let out = p;
      if (out.loc?.[lang]) { const loc = { ...out.loc }; delete loc[lang]; out = { ...out, loc: Object.keys(loc).length ? loc : undefined } as ModPackage; }
      for (const k of KINDS) {
        const list = out[k] as AnyItem[] | undefined;
        if (list?.some((it) => it?.loc?.[lang])) out = { ...out, [k]: list.map((it) => { if (!it?.loc?.[lang]) return it; const loc = { ...it.loc }; delete loc[lang]; return { ...it, loc: Object.keys(loc).length ? loc : undefined }; }) } as ModPackage;
      }
      return out;
    });
  };
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title"><Icon name="translate" size={22} />{t.translations.title}</h1>
          <p className="page__lead">{t.translations.lead}</p>
        </div>
        <div className="page__tools">
          <Select<string> label={t.translations.language} value={lang} onChange={setLang}
            options={GAME_LANGUAGES.filter((l) => l.key !== 'en-us').map((l) => ({ value: l.key, label: `${l.name}${used.has(l.key) ? ' •' : ''}` }))} />
          <span className="badge badge--neutral">{t.translations.done(done, rows.length)}</span>
          <Toggle checked={missing_only} onChange={setMissingOnly} label={t.translations.only_missing} />
          <Toggle checked={previews} onChange={setPreviews} label={t.workspace.toggle_preview} />
          {used.has(lang) ? <Button tone="ghost" icon="trash" onClick={() => void remove_language()}>{t.translations.remove_language}</Button> : null}
        </div>
      </header>
      {shown.length ? (
        <div className={`tr-table ${previews ? 'tr-table--previews' : ''}`} role="table">
          {shown.map((r) => (
            <div key={r.id} className="tr-row" role="row">
              <div className="tr-row__label" role="cell">
                {r.kind !== 'mod' ? <Icon name={KIND_ICON[r.kind as keyof typeof KIND_ICON]} size={15} /> : <Icon name="home" size={15} />}
                <b>{r.label}</b>
                <Button size="sm" tone="ghost" icon="copy" onClick={() => copy_source(r)}>{t.translations.copy_source}</Button>
              </div>
              <div className="tr-row__source" role="cell">
                <p className="tr-row__name">{r.en_name}</p>
                {r.is_mod ? <p className="muted small">{r.en_text.join(' ')}</p> : <div className="tr-row__game"><GameText lines={r.en_text} vars={r.vars} /></div>}
              </div>
              <div className="tr-row__edit" role="cell">
                <TextInput aria-label={t.translations.name} value={r.name ?? ''} maxLength={r.is_mod ? 60 : 40} placeholder={r.en_name}
                  onChange={(v) => put(r, 'name', v || undefined)} />
                {r.is_mod ? (
                  <TextArea aria-label={t.translations.description} rows={2} value={r.text?.[0] ?? ''} placeholder={r.en_text[0]} onChange={(v) => put(r, 'text', v || undefined)} />
                ) : r.en_text.length || r.text?.length ? (
                  <MarkupInput label={t.translations.text} lines={r.text?.length ? r.text : ['']} vars={r.vars}
                    onChange={(l) => put(r, 'text', l.length === 1 && !l[0] ? undefined : l)} />
                ) : null}
              </div>
              {previews && r.kind !== 'mod' && r.index !== undefined ? (
                <div className="tr-row__preview" role="cell">
                  <CardPreview kind={r.kind as (typeof KINDS)[number]} item={((pkg[r.kind as (typeof KINDS)[number]] ?? []) as AnyItem[])[r.index]} pkg={pkg} lang={lang} scale={1} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : <p className="muted">{t.translations.nothing}</p>}
    </div>
  );
}
