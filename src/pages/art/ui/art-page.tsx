// The mod's images: each one card (142 x 190), drawn here or uploaded, with
// the items that show it. A drawing keeps its layers, so it can be changed.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { use_pick_items } from '@/entities/catalog';
import { use_field_issues, useProject } from '@/entities/project';
import { ArtStudio, type StudioResult } from '@/widgets/art-studio';
import { useI18n } from '@/shared/i18n';
import { data_url_bytes, file_url, fit_card, image_pixels, pick_files, slug, unique } from '@/shared/lib';
import { ASSET_NAME, KINDS, MAX_ASSET_BYTES, MAX_ASSETS, rename_asset, type AnyItem } from '@/shared/lib/mod';
import { Button, CardArt, Empty, Icon, IconButton, LinkButton, Segmented, TextInput, useConfirm, useToast } from '@/shared/ui';

function AssetCard({ name, url }: { name: string; url: string }) {
  const { t, f } = useI18n();
  const { pkg, project, change_all } = useProject();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const errors = use_field_issues(`assets.${name}`);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [size, setSize] = useState<[number, number] | null>(null);
  useEffect(() => { void image_pixels(url).then((d) => setSize([d.width, d.height]), () => setSize(null)); }, [url]);
  const users = KINDS.flatMap((k) => ((pkg[k] ?? []) as AnyItem[]).filter((it) => it?.sprite === name).map((it) => it.name || it.key));
  const taken = Object.keys(pkg.assets ?? {}).filter((n) => n !== name);
  const draft_ok = new RegExp(ASSET_NAME).test(draft) && !taken.includes(draft);
  const rename = () => {
    if (!draft_ok || draft === name) { setRenaming(false); setDraft(name); return; }
    change_all(({ pkg: p, art }) => {
      const a = { ...art };
      if (a[name]) { a[draft] = a[name]; delete a[name]; }
      return { pkg: rename_asset(p, name, draft), art: a };
    });
    setRenaming(false);
  };
  const remove = async () => {
    if (users.length && !(await confirm(t.art.delete_used(users.join(', '))))) return;
    if (!users.length && !(await confirm(`${t.common.delete} ${name}?`))) return;
    change_all(({ pkg: p, art }) => {
      const assets = { ...(p.assets ?? {}) };
      delete assets[name];
      const next: Record<string, unknown> = { ...p, assets };
      for (const k of KINDS) {
        const list = p[k] as AnyItem[] | undefined;
        if (list?.some((it) => it?.sprite === name)) next[k] = list.map((it) => { if (it?.sprite !== name) return it; const c = { ...it }; delete c.sprite; return c; });
      }
      const a = { ...art };
      delete a[name];
      return { pkg: next as unknown as typeof p, art: a };
    });
  };
  return (
    <article className={`asset ${errors.some((e) => e.level === 'error') ? 'has-error' : ''}`} data-path={`assets.${name}`}>
      <button type="button" className="asset__image" onClick={() => navigate(`/p/${project.id}/art/${encodeURIComponent(name)}`)} aria-label={`${t.common.edit} ${name}`}>
        <CardArt picture={{ image: url }} scale={1.4} />
      </button>
      <div className="asset__body">
        {renaming ? (
          <TextInput mono autoFocus value={draft} maxLength={48} onChange={(v) => setDraft(v.toLowerCase())} onBlur={rename}
            onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') { setRenaming(false); setDraft(name); } }}
            aria-label={t.art.rename_prompt} />
        ) : <code className="asset__name">{name}</code>}
        <span className="muted small">{size ? `${size[0]} × ${size[1]} · ` : ''}{f.bytes(data_url_bytes(url))}</span>
        <span className="small">{users.length ? t.art.used_by(users.join(', ')) : <span className="muted">{t.art.unused}</span>}</span>
        {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
        <div className="asset__tools">
          <IconButton size="sm" icon="pencil" label={t.common.edit} onClick={() => navigate(`/p/${project.id}/art/${encodeURIComponent(name)}`)} />
          <IconButton size="sm" icon="file" label={t.common.rename} onClick={() => setRenaming(true)} />
          <IconButton size="sm" icon="trash" label={t.common.delete} onClick={() => void remove()} />
        </div>
      </div>
    </article>
  );
}

function Studio({ name }: { name: string | null }) {
  const { t } = useI18n();
  const { pkg, project, change_all } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const trace = use_pick_items(['jokers', 'tarots', 'planets', 'spectrals', 'vouchers']);
  const assets = pkg.assets ?? {};
  const fresh = useMemo(() => unique('drawing', Object.keys(assets), 48), [assets]);
  const save = (r: StudioResult) => {
    change_all(({ pkg: p0, art: art0 }) => {
      const p = name && name !== r.name ? rename_asset(p0, name, r.name) : p0;
      const art = { ...art0, [r.name]: r.source };
      if (name && name !== r.name) delete art[name];
      return { pkg: { ...p, assets: { ...(p.assets ?? {}), [r.name]: r.png } }, art };
    });
    toast(t.art.studio.saved, 'ok');
    if (name !== r.name) navigate(`/p/${project.id}/art/${encodeURIComponent(r.name)}`, { replace: true });
  };
  return (
    <div className="page page--studio">
      <header className="page__head">
        <div className="crumbs">
          <LinkButton to={`/p/${project.id}/art`} tone="ghost" size="sm" icon="palette">{t.art.title}</LinkButton>
          <Icon name="chevron-right" size={14} />
          <span className="crumbs__here">{name ?? t.art.new_drawing}</span>
        </div>
      </header>
      <ArtStudio key={name ?? 'new'} name={name ?? fresh} image={name ? assets[name] : undefined} source={name ? project.art[name] : undefined}
        taken={Object.keys(assets).filter((n) => n !== name)} trace_items={trace} onSave={save}
        onCancel={() => navigate(`/p/${project.id}/art`)} />
    </div>
  );
}

export function ArtPage() {
  const { t } = useI18n();
  const { asset } = useParams();
  const { pkg, project, change } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<'pixel' | 'smooth'>('pixel');
  const assets = pkg.assets ?? {};
  if (asset !== undefined) return <Studio name={asset === 'new' ? null : decodeURIComponent(asset)} />;
  const upload = async () => {
    const files = await pick_files('image/*', true);
    for (const file of files) {
      try {
        const png = await fit_card(await file_url(file), mode);
        if (data_url_bytes(png) > MAX_ASSET_BYTES) { toast(`${file.name}: ${t.sprites.too_big}`, 'error'); continue; }
        change((p) => {
          const a = p.assets ?? {};
          if (Object.keys(a).length >= MAX_ASSETS) return p;
          const name = unique(slug(file.name.replace(/\.[a-z0-9]+$/i, ''), 40, 'image'), Object.keys(a), 48);
          return { ...p, assets: { ...a, [name]: png } };
        });
      } catch {
        toast(`${file.name}: ${t.sprites.upload_failed}`, 'error');
      }
    }
  };
  const count = Object.keys(assets).length;
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title"><Icon name="palette" size={22} />{t.art.title}</h1>
          <p className="page__lead">{t.art.lead}</p>
        </div>
        <div className="page__tools">
          <span className="muted small">{t.art.of_max(count, MAX_ASSETS)}</span>
          <Segmented size="sm" label={t.sprites.upload_mode} value={mode} onChange={setMode} options={[{ value: 'pixel', label: t.sprites.pixel }, { value: 'smooth', label: t.sprites.smooth }]} />
          <Button icon="upload" onClick={() => void upload()} disabled={count >= MAX_ASSETS}>{t.art.upload}</Button>
          <Button tone="primary" icon="pencil" onClick={() => navigate(`/p/${project.id}/art/new`)} disabled={count >= MAX_ASSETS}>{t.art.new_drawing}</Button>
        </div>
      </header>
      {count ? (
        <div className="assets">
          {Object.entries(assets).map(([name, url]) => <AssetCard key={name} name={name} url={url} />)}
        </div>
      ) : <Empty icon="image" title={t.art.empty} actions={<Button tone="primary" icon="pencil" onClick={() => navigate(`/p/${project.id}/art/new`)}>{t.art.new_drawing}</Button>} />}
    </div>
  );
}
