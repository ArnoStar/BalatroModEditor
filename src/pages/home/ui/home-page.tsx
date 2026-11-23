// The mods in this browser: start a new one (empty, from a template or from
// an example), import a file, edit a copy of a mod installed in the game or
// the next version of one published, and open, copy, export or delete them.
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { ItemThumb, useCatalog } from '@/entities/catalog';
import {
  create_project, delete_project, list_projects, new_project, save_project, summary_of, type Project, type ProjectOrigin,
} from '@/entities/project';
import { useSession } from '@/entities/session';
import { export_package } from '@/features/export-mod';
import { SiteBar } from '@/widgets/site-bar';
import { game_library, mods_api, type InstalledMod, type ModSummaryView } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { pick_files, slug, use_async } from '@/shared/lib';
import {
  check_package, ID_PATTERN, KINDS, mod_template, package_hash, rename_mod_id, type AnyItem, type ModPackage, type ModTemplateId,
} from '@/shared/lib/mod';
import { Badge, Button, Empty, Field, Icon, IconButton, Menu, Modal, Notice, Spinner, TextInput, useConfirm, useToast } from '@/shared/ui';

const TEMPLATES: ModTemplateId[] = ['blank', 'jokers', 'everything', 'rules', 'creative'];

function is_package(x: unknown): x is ModPackage {
  return !!x && typeof x === 'object' && !Array.isArray(x) && 'format' in x && 'id' in x && 'name' in x;
}

function ProjectCard({ p, onDelete, onDuplicate }: { p: Project; onDelete: () => void; onDuplicate: () => void }) {
  const { t, f } = useI18n();
  const { keys } = useCatalog();
  const navigate = useNavigate();
  const s = summary_of(p.pkg);
  const errors = useMemo(() => check_package(p.pkg, keys).filter((i) => i.level === 'error').length, [p.pkg, keys]);
  const thumbs = KINDS.flatMap((k) => ((p.pkg[k] ?? []) as AnyItem[]).map((it) => ({ k, it }))).slice(0, 5);
  const parts = KINDS.filter((k) => s[k]).map((k) => t.kinds[k].count(s[k]));
  if (s.rules) parts.push(t.home.rules);
  if (s.creative) parts.push(t.home.creative);
  return (
    <article className="project">
      <button type="button" className="project__open" onClick={() => navigate(`/p/${p.id}`)} aria-label={`${t.common.open}: ${p.pkg.name}`}>
        <span className="project__thumbs" aria-hidden>
          {thumbs.length ? thumbs.map(({ k, it }, i) => <span key={i} className="project__thumb" style={{ '--i': i } as React.CSSProperties}><ItemThumb kind={k} item={it} assets={p.pkg.assets} scale={0.62} /></span>)
            : <span className="project__blank"><Icon name="sparkle" size={30} /></span>}
        </span>
        <span className="project__body">
          <span className="project__name">{p.pkg.name || p.pkg.id}</span>
          <span className="project__meta"><code>{p.pkg.id}</code> · {t.common.version(p.pkg.version)}</span>
          <span className="project__parts">{parts.length ? parts.join(' · ') : t.home.nothing_yet}</span>
          <span className="project__foot">
            {errors ? <Badge tone="error"><Icon name="alert" size={12} />{t.home.problems(errors)}</Badge> : <Badge tone="ok"><Icon name="check" size={12} />{t.home.ready}</Badge>}
            {p.published ? <Badge tone="gold"><Icon name="rocket" size={12} />{t.common.version(p.published.version)}</Badge> : null}
            <span className="muted small">{t.home.edited(f.ago(p.updated_at))}</span>
          </span>
        </span>
      </button>
      <Menu label={t.common.more} align="end" width={220} items={[
        { label: t.common.open, icon: 'folder', onSelect: () => navigate(`/p/${p.id}`) },
        { label: t.common.duplicate, icon: 'copy', onSelect: onDuplicate },
        { label: t.workspace.export, icon: 'download', onSelect: () => export_package(p.pkg) },
        { label: t.common.delete, icon: 'trash', danger: true, onSelect: onDelete },
      ]} trigger={(props) => <IconButton icon="more" label={t.common.more} className="project__menu" {...props} />} />
    </article>
  );
}

function NewModDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (pkg: ModPackage, origin: ProjectOrigin) => void }) {
  const { t, describe } = useI18n();
  const { account } = useSession();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [id_edited, setIdEdited] = useState(false);
  const [choice, setChoice] = useState<string>('jokers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const examples = use_async(() => (open ? mods_api.list({ tag: 'example', limit: 20 }).then((l) => l.items.filter((m) => m.official && !m.summary.creative)) : Promise.resolve([] as ModSummaryView[])), [open]);
  useEffect(() => { if (open) { setName(''); setId(''); setIdEdited(false); setError(null); setChoice('jokers'); } }, [open]);
  const auto_id = (n: string) => slug(n, 32, 'mod').padEnd(3, '_');
  const shown_id = id_edited ? id : auto_id(name || 'my_mod');
  const id_ok = new RegExp(ID_PATTERN).test(shown_id) && shown_id !== 'pvp' && shown_id !== 'coop';
  const create = async () => {
    const mod_name = name.trim() || 'My Mod';
    setBusy(true);
    setError(null);
    try {
      if (choice.startsWith('example:')) {
        const ex = choice.slice('example:'.length);
        const pkg = await mods_api.download(ex);
        const copy = rename_mod_id({ ...pkg, name: name.trim() || pkg.name, version: '1.0.0', author: account?.display_name ?? '' }, shown_id);
        onCreate({ ...copy, assets: copy.assets ?? {} }, { kind: 'example', ref: ex });
      } else {
        onCreate(mod_template(choice as ModTemplateId, mod_name, shown_id, account?.display_name ?? ''), { kind: choice === 'blank' ? 'blank' : 'template', ref: choice });
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const tpl = t.home.new_dialog.templates;
  return (
    <Modal open={open} onClose={onClose} title={t.home.new_dialog.title} size="lg"
      footer={<>
        <Button tone="ghost" onClick={onClose}>{t.common.cancel}</Button>
        <Button tone="primary" icon="plus" busy={busy} disabled={!id_ok} onClick={() => void create()}>{t.home.new_dialog.create}</Button>
      </>}>
      <div className="grid-2">
        <Field label={t.home.new_dialog.name}>
          {(fid) => <TextInput id={fid} autoFocus value={name} maxLength={60} placeholder={t.home.new_dialog.name_placeholder} onChange={setName} />}
        </Field>
        <Field label={t.home.new_dialog.id} help={t.home.new_dialog.id_help}
          errors={!id_ok ? [{ text: t.problems.message({ k: 'pattern', value: shown_id, pattern: ID_PATTERN }), level: 'error' }] : undefined}>
          {(fid, d) => <TextInput id={fid} aria-describedby={d} mono maxLength={32} value={shown_id} onChange={(v) => { setIdEdited(true); setId(v.toLowerCase().replace(/[^a-z0-9_]/g, '_')); }} />}
        </Field>
      </div>
      <p className="field__label">{t.home.new_dialog.template}</p>
      <div className="choices" role="radiogroup" aria-label={t.home.new_dialog.template}>
        {TEMPLATES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={choice === k} className={`choice ${choice === k ? 'is-on' : ''}`} onClick={() => setChoice(k)}>
            <span className="choice__name">{tpl[k].name}</span>
            <span className="choice__text">{tpl[k].text}</span>
          </button>
        ))}
      </div>
      <p className="field__label">{t.home.new_dialog.examples}</p>
      {examples.loading ? <p className="muted small"><Spinner size="sm" /> {t.home.new_dialog.example_loading}</p>
        : examples.error || !examples.data?.length ? <p className="muted small">{t.home.new_dialog.example_offline}</p> : (
          <div className="choices" role="radiogroup" aria-label={t.home.new_dialog.examples}>
            {examples.data.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={choice === `example:${m.id}`} className={`choice ${choice === `example:${m.id}` ? 'is-on' : ''}`}
                onClick={() => { setChoice(`example:${m.id}`); if (!name) setName(`My ${m.name}`); }}>
                <span className="choice__name">{m.name}</span>
                <span className="choice__text">{m.description.slice(0, 120)}{m.description.length > 120 ? '…' : ''}</span>
              </button>
            ))}
          </div>
        )}
      {error ? <Notice tone="error">{describe(error)}</Notice> : null}
    </Modal>
  );
}

function GameDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: InstalledMod) => void }) {
  const { t, describe } = useI18n();
  const mods = use_async(() => (open ? game_library.list() : Promise.resolve([])), [open]);
  return (
    <Modal open={open} onClose={onClose} title={t.home.game_dialog.title} size="md">
      <p className="muted">{t.home.game_dialog.text}</p>
      {mods.loading ? <Spinner /> : mods.error ? <Notice tone="error">{describe(mods.error)}</Notice> : !mods.data?.length ? <p className="muted">{t.home.game_dialog.none}</p> : (
        <ul className="pick-list">
          {mods.data.map((m) => (
            <li key={m.id}>
              <span><b>{m.name}</b> <code>{m.id}</code> {t.common.version(m.version)} {m.official ? <Badge>{t.home.game_dialog.official}</Badge> : null}</span>
              <Button size="sm" icon="copy" onClick={() => onPick(m)}>{t.home.game_dialog.edit}</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function PublishedDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: ModSummaryView) => void }) {
  const { t, describe } = useI18n();
  const { can_act, sign_in_url } = useSession();
  const mods = use_async(() => (open && can_act ? mods_api.list({ mine: true, limit: 100 }).then((l) => l.items) : Promise.resolve([])), [open, can_act]);
  return (
    <Modal open={open} onClose={onClose} title={t.home.published_dialog.title} size="md">
      {!can_act ? <Notice>{t.home.published_dialog.sign_in} <a href={sign_in_url}>{t.app.sign_in}</a></Notice> : (
        <>
          <p className="muted">{t.home.published_dialog.text}</p>
          {mods.loading ? <Spinner /> : mods.error ? <Notice tone="error">{describe(mods.error)}</Notice> : !mods.data?.length ? <p className="muted">{t.home.published_dialog.none}</p> : (
            <ul className="pick-list">
              {mods.data.map((m) => (
                <li key={m.id}>
                  <span><b>{m.name}</b> <code>{m.id}</code> {t.common.version(m.version)}</span>
                  <Button size="sm" icon="folder" onClick={() => onPick(m)}>{t.home.published_dialog.open}</Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

export function HomePage() {
  const { t, describe } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const projects = use_async(() => list_projects(), []);
  const [dialog, setDialog] = useState<'new' | 'game' | 'published' | null>(null);
  const [dropping, setDropping] = useState(false);

  const create = async (pkg: ModPackage, origin: ProjectOrigin, published?: Project['published']) => {
    try {
      const p = new_project(pkg, origin);
      if (published) p.published = published;
      await save_project(p);
      navigate(`/p/${p.id}`);
    } catch {
      toast(t.errors.storage, 'error');
    }
  };
  const import_text = async (text: string, file_name: string) => {
    let data: unknown;
    try { data = JSON.parse(text); } catch { toast(t.home.not_json, 'error'); return; }
    if (!is_package(data)) { toast(t.home.not_mod, 'error'); return; }
    const already = projects.data?.some((p) => p.pkg.id === data.id);
    if (already) toast(t.home.already(String(data.name)), 'info');
    else toast(t.home.imported(String(data.name)), 'ok');
    await create(data, { kind: 'file', ref: file_name });
  };
  const import_files = async () => {
    const [file] = await pick_files('.json,application/json');
    if (file) await import_text(await file.text(), file.name);
  };
  const drop = async (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const file = [...e.dataTransfer.files].find((f) => f.name.endsWith('.json') || f.type === 'application/json');
    if (file) await import_text(await file.text(), file.name);
  };
  const remove = async (p: Project) => {
    if (!(await confirm(t.home.delete_confirm(p.pkg.name || p.pkg.id)))) return;
    await delete_project(p.id);
    projects.reload();
  };
  const duplicate = async (p: Project) => {
    const copy = await create_project({ ...structuredClone(p.pkg), name: `${p.pkg.name} (2)` }, { kind: 'copy', ref: p.id });
    copy.art = structuredClone(p.art);
    await save_project(copy);
    projects.reload();
  };
  const open_published = async (m: ModSummaryView) => {
    try {
      const pkg = await mods_api.download(m.id);
      await create(pkg, { kind: 'registry', ref: m.id }, { version: pkg.version, hash: await package_hash(pkg), at: Date.now() });
    } catch (e) {
      toast(describe(e), 'error');
    }
  };

  return (
    <div className={`home ${dropping ? 'is-dropping' : ''}`} onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }} onDrop={(e) => void drop(e)}>
      <SiteBar />
      <main className="home__main" id="main">
        <section className="hero">
          <div className="hero__text">
            <h1 className="hero__title">{t.home.title}</h1>
            <p className="hero__lead">{t.home.lead}</p>
            <div className="hero__actions">
              <Button tone="primary" size="lg" icon="plus" onClick={() => setDialog('new')}>{t.home.new_mod}</Button>
              <Button size="lg" icon="upload" onClick={() => void import_files()}>{t.home.import_file}</Button>
              <Button size="lg" tone="ghost" icon="play" onClick={() => setDialog('game')}>{t.home.from_game}</Button>
              <Button size="lg" tone="ghost" icon="rocket" onClick={() => setDialog('published')}>{t.home.published}</Button>
            </div>
          </div>
          <div className="hero__art" aria-hidden>
            <span className="hero__card hero__card--a" /><span className="hero__card hero__card--b" /><span className="hero__card hero__card--c" />
          </div>
        </section>
        {projects.loading && !projects.data ? <Spinner size="lg" /> : projects.data?.length ? (
          <section className="projects" aria-label={t.home.title}>
            {projects.data.map((p) => <ProjectCard key={p.id} p={p} onDelete={() => void remove(p)} onDuplicate={() => void duplicate(p)} />)}
          </section>
        ) : (
          <Empty icon="sparkle" title={t.home.empty_title} actions={<Button tone="primary" icon="plus" onClick={() => setDialog('new')}>{t.home.new_mod}</Button>}>
            {t.home.empty_text}
          </Empty>
        )}
        <p className="home__note"><Icon name="info" size={14} /> {t.home.storage_note}</p>
      </main>
      {dropping ? <div className="dropzone" aria-hidden><Icon name="upload" size={40} /><p>{t.home.drop}</p></div> : null}
      <NewModDialog open={dialog === 'new'} onClose={() => setDialog(null)} onCreate={(pkg, origin) => void create(pkg, origin)} />
      <GameDialog open={dialog === 'game'} onClose={() => setDialog(null)} onPick={(m) => void create(m.package, { kind: 'game', ref: m.id })} />
      <PublishedDialog open={dialog === 'published'} onClose={() => setDialog(null)} onPick={(m) => void open_published(m)} />
    </div>
  );
}
