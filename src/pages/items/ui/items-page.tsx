// A kind of item: all of them (a gallery, with new ones from scratch or from a
// template), or one, in its form, with its preview as the game shows it.
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ItemThumb } from '@/entities/catalog';
import { useProject } from '@/entities/project';
import { CardPreview } from '@/widgets/card-preview';
import { GAME_LANGUAGES, useI18n } from '@/shared/i18n';
import {
  blank_item, from_template, ITEM_TEMPLATES, KINDS, moved, type AnyItem, type ItemKind,
} from '@/shared/lib/mod';
import { plain_line } from '@/shared/lib/mod';
import { Button, Empty, Icon, IconButton, KIND_ICON, KIND_TONE, LinkButton, Menu, ProblemsBadge, useConfirm } from '@/shared/ui';
import { BlindForm, ConsumableForm, DeckForm, JokerForm, VoucherForm } from './forms';

function NewMenu({ kind }: { kind: ItemKind }) {
  const { t } = useI18n();
  const { change, pkg, project } = useProject();
  const navigate = useNavigate();
  const add = (item: AnyItem) => {
    const n = ((pkg[kind] ?? []) as AnyItem[]).length;
    change((p) => ({ ...p, [kind]: [...((p[kind] ?? []) as AnyItem[]), item] }));
    navigate(`/p/${project.id}/${kind}/${n}`);
  };
  const templates = ITEM_TEMPLATES.filter((x) => x.kind === kind);
  return (
    <Menu label={t.kinds[kind].new_} width={300} align="end" items={[
      { label: t.items.new_blank, icon: 'plus', onSelect: () => add(blank_item(kind, pkg)) },
      { group: t.items.from_template, label: '' },
      ...templates.map((tpl) => ({ label: t.items.templates[tpl.id] ?? tpl.id, hint: tpl.make().name, icon: KIND_ICON[kind], onSelect: () => add(from_template(tpl, pkg)) })),
    ]} trigger={(p) => <Button tone="primary" icon="plus" {...p}>{t.kinds[kind].new_}</Button>} />
  );
}

function Gallery({ kind }: { kind: ItemKind }) {
  const { t } = useI18n();
  const { pkg, project, issues_under } = useProject();
  const list = (pkg[kind] ?? []) as AnyItem[];
  return (
    <div className="page">
      <header className="page__head" style={{ '--tone': KIND_TONE[kind] } as React.CSSProperties}>
        <div>
          <h1 className="page__title"><Icon name={KIND_ICON[kind]} size={22} />{t.kinds[kind].many}</h1>
          <p className="page__lead">{t.kinds[kind].count(list.length)}</p>
        </div>
        <NewMenu kind={kind} />
      </header>
      {list.length ? (
        <div className="gallery">
          {list.map((it, i) => {
            const errs = issues_under(`${kind}[${i}]`).filter((x) => x.level === 'error').length;
            return (
              <LinkButton key={i} to={`/p/${project.id}/${kind}/${i}`} className="gallery__item" tone="ghost">
                <ItemThumb kind={kind} item={it} assets={pkg.assets} scale={1} />
                <span className="gallery__name">{it?.name || it?.key}</span>
                <span className="gallery__text">{(it?.text ?? []).map((l) => plain_line(l)).join(' ')}</span>
                <ProblemsBadge errors={errs} />
              </LinkButton>
            );
          })}
        </div>
      ) : (
        <Empty icon={KIND_ICON[kind]} title={t.items.gallery_empty} actions={<NewMenu kind={kind} />} />
      )}
    </div>
  );
}

function Editor({ kind, index }: { kind: ItemKind; index: number }) {
  const { t } = useI18n();
  const { pkg, project, change } = useProject();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [lang, setLang] = useState('en-us');
  const list = (pkg[kind] ?? []) as AnyItem[];
  const item = list[index];
  const base = `/p/${project.id}/${kind}`;
  if (!item) return <div className="page"><Empty icon="alert" title={t.items.not_found} actions={<LinkButton to={base}>{t.kinds[kind].many}</LinkButton>} /></div>;
  const langs = ['en-us', ...Object.keys((item as { loc?: object }).loc ?? {})];
  const remove = async () => {
    if (!(await confirm(t.items.delete_confirm(item.name || item.key)))) return;
    change((p) => ({ ...p, [kind]: ((p[kind] ?? []) as AnyItem[]).filter((_, i) => i !== index) }));
    navigate(list.length > 1 ? `${base}/${Math.max(0, index - 1)}` : base);
  };
  const duplicate = () => {
    const taken = new Set(list.map((x) => x.key));
    let key = `${String(item.key).slice(0, 27)}_copy`;
    for (let n = 2; taken.has(key); n++) key = `${String(item.key).slice(0, 26)}_copy${n}`;
    const copy = { ...structuredClone(item), key } as AnyItem;
    change((p) => {
      const l = ((p[kind] ?? []) as AnyItem[]).slice();
      l.splice(index + 1, 0, copy);
      return { ...p, [kind]: l };
    });
    navigate(`${base}/${index + 1}`);
  };
  const shift = (d: number) => {
    change((p) => ({ ...p, [kind]: moved((p[kind] ?? []) as AnyItem[], index, index + d) }));
    navigate(`${base}/${index + d}`);
  };
  const form = kind === 'jokers' ? <JokerForm index={index} /> : kind === 'consumables' ? <ConsumableForm index={index} />
    : kind === 'vouchers' ? <VoucherForm index={index} /> : kind === 'decks' ? <DeckForm index={index} /> : <BlindForm index={index} />;
  return (
    <div className="page page--item" style={{ '--tone': KIND_TONE[kind] } as React.CSSProperties}>
      <header className="page__head page__head--item">
        <div className="crumbs">
          <LinkButton to={base} tone="ghost" size="sm" icon={KIND_ICON[kind]}>{t.kinds[kind].many}</LinkButton>
          <Icon name="chevron-right" size={14} />
          <span className="crumbs__here">{item.name || item.key}</span>
        </div>
        <div className="page__tools">
          <IconButton icon="chevron-left" label={t.common.back} disabled={index === 0} onClick={() => navigate(`${base}/${index - 1}`)} />
          <span className="muted small">{index + 1} / {list.length}</span>
          <IconButton icon="chevron-right" label={t.common.more} disabled={index >= list.length - 1} onClick={() => navigate(`${base}/${index + 1}`)} />
          <span className="topbar__sep" />
          <IconButton icon="arrow-up" label={t.common.move_up} disabled={index === 0} onClick={() => shift(-1)} />
          <IconButton icon="arrow-down" label={t.common.move_down} disabled={index >= list.length - 1} onClick={() => shift(1)} />
          <IconButton icon="copy" label={t.common.duplicate} onClick={duplicate} />
          <IconButton icon="trash" label={t.common.delete} tone="danger" onClick={() => void remove()} />
        </div>
      </header>
      <div className="item-layout">
        <div className="item-layout__form">{form}</div>
        <aside className="item-layout__preview">
          <div className="sticky">
            <div className="preview-head">
              <span className="preview-head__title">{t.preview.title}</span>
              {langs.length > 1 ? (
                <select className="preview-head__lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t.preview.language}>
                  {langs.map((l) => <option key={l} value={l}>{GAME_LANGUAGES.find((x) => x.key === l)?.name ?? l}</option>)}
                </select>
              ) : null}
            </div>
            <CardPreview kind={kind} item={item} pkg={pkg} lang={lang} />
            <p className="muted small preview-note">{t.preview.sample}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ItemsPage() {
  const { kind = '', index } = useParams();
  const { project } = useProject();
  if (!(KINDS as string[]).includes(kind)) return <Navigate to={`/p/${project.id}`} replace />;
  if (index === undefined) return <Gallery kind={kind as ItemKind} />;
  return <Editor key={`${kind}:${index}`} kind={kind as ItemKind} index={Number(index)} />;
}
