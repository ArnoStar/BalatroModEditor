// The editor around one mod: the bar on top (the mod, saving, undo and redo,
// its problems, testing and publishing), the list of everything in it on the
// left, and the page being edited. Ctrl/⌘+Z undoes anything, typing included.
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { ItemThumb, useCatalog } from '@/entities/catalog';
import { load_project, ProblemList, ProjectProvider, useProject } from '@/entities/project';
import { Account } from '@/entities/session';
import { ExportButton } from '@/features/export-mod';
import { useI18n } from '@/shared/i18n';
import { shortcut, use_async, use_hotkeys } from '@/shared/lib';
import { blank_item, KINDS, type AnyItem, type ItemKind } from '@/shared/lib/mod';
import {
  Badge, Brand, Empty, Icon, IconButton, KIND_ICON, KIND_TONE, LanguageSelect, LinkButton, Spinner, useToast, type IconName,
} from '@/shared/ui';


export function Workspace() {
  const { pid = '' } = useParams();
  const { t } = useI18n();
  const { keys } = useCatalog();
  const state = use_async(() => load_project(pid), [pid]);
  if (state.loading && !state.data) return <div className="ws-loading"><Spinner size="lg" label={t.workspace.loading} /></div>;
  if (!state.data) {
    return (
      <div className="ws-missing">
        <Empty icon="folder" title={t.workspace.not_found} actions={<LinkButton to="/" icon="chevron-left">{t.app.to_home}</LinkButton>} />
      </div>
    );
  }
  return (
    <ProjectProvider key={state.data.id} initial={state.data} known={keys}>
      <Shell />
    </ProjectProvider>
  );
}

function SaveState() {
  const { t } = useI18n();
  const { save_status } = useProject();
  const text = save_status === 'saved' ? t.workspace.saved : save_status === 'saving' ? t.workspace.saving : t.workspace.save_failed;
  return (
    <span className={`save-state save-state--${save_status}`} role="status">
      <Icon name={save_status === 'error' ? 'alert' : save_status === 'saving' ? 'refresh' : 'check'} size={14} />
      <span>{text}</span>
    </span>
  );
}

function TopBar({ onProblems }: { onProblems: () => void }) {
  const { t } = useI18n();
  const { pkg, project, undo, redo, can_undo, can_redo, errors, warnings } = useProject();
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar__mod">
        <span className="topbar__name">{pkg.name || pkg.id || '—'}</span>
        <code className="topbar__id">{pkg.id}</code>
        <Badge>{t.common.version(pkg.version)}</Badge>
        <SaveState />
      </div>
      <div className="topbar__tools">
        <IconButton icon="undo" label={`${t.workspace.undo} (${shortcut('mod+z')})`} disabled={!can_undo} onClick={undo} />
        <IconButton icon="redo" label={`${t.workspace.redo} (${shortcut('mod+shift+z')})`} disabled={!can_redo} onClick={redo} />
        <button type="button" className={`problems-btn ${errors ? 'has-errors' : warnings ? 'has-warnings' : 'is-clean'}`} onClick={onProblems}
          aria-label={t.workspace.problems}>
          {errors ? <><Icon name="alert" size={15} /><span>{errors}</span></> : null}
          {warnings ? <><Icon name="info" size={15} /><span>{warnings}</span></> : null}
          {!errors && !warnings ? <><Icon name="check" size={15} /><span>{t.workspace.no_problems}</span></> : null}
        </button>
        <span className="topbar__sep" />
        <ExportButton pkg={pkg} icon_only />
        <LinkButton to={`/p/${project.id}/test`} icon="flask" size="md" tone="ghost">{t.workspace.sections.test}</LinkButton>
        <LinkButton to={`/p/${project.id}/publish`} icon="rocket" size="md" tone="primary">{t.workspace.sections.publish}</LinkButton>
        <span className="topbar__sep" />
        <LanguageSelect />
        <Account />
      </div>
    </header>
  );
}

function Tree() {
  const { t } = useI18n();
  const { pkg, project, change, issues_under } = useProject();
  const navigate = useNavigate();
  const base = `/p/${project.id}`;
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const add = (kind: ItemKind) => {
    const list = (pkg[kind] ?? []) as AnyItem[];
    change((p) => ({ ...p, [kind]: [...((p[kind] ?? []) as AnyItem[]), blank_item(kind, p)] }));
    navigate(`${base}/${kind}/${list.length}`);
  };
  const dot = (path: string) => {
    const list = issues_under(path);
    if (list.some((i) => i.level === 'error')) return <span className="dot dot--error" aria-label={t.common.errors_n(list.filter((i) => i.level === 'error').length)} />;
    return null;
  };
  const tool = (to: string, icon: IconName, label: string, count?: number) => (
    <NavLink to={`${base}${to}`} end className="tree__link">
      <Icon name={icon} size={17} />
      <span className="tree__label">{label}</span>
      {count ? <span className="tree__count">{count}</span> : null}
    </NavLink>
  );
  const package_level = issues_under('').filter((i) => !/^(jokers|consumables|vouchers|decks|blinds|assets)/.test(i.path));
  return (
    <nav className="tree" aria-label={t.app.nav_label}>
      <NavLink to={base} end className="tree__link">
        <Icon name="home" size={17} />
        <span className="tree__label">{t.workspace.sections.overview}</span>
        {package_level.some((i) => i.level === 'error') ? <span className="dot dot--error" /> : null}
      </NavLink>
      <p className="tree__group">{t.workspace.content}</p>
      {KINDS.map((kind) => {
        const list = (pkg[kind] ?? []) as AnyItem[];
        const open = !closed[kind];
        return (
          <div key={kind} className="tree__kind" style={{ '--tone': KIND_TONE[kind] } as React.CSSProperties}>
            <div className="tree__kind-row">
              <button type="button" className="tree__fold" aria-expanded={open} aria-label={t.kinds[kind].many}
                onClick={() => setClosed((c) => ({ ...c, [kind]: open }))}>
                <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
              </button>
              <NavLink to={`${base}/${kind}`} end className="tree__link tree__link--kind">
                <Icon name={KIND_ICON[kind]} size={17} />
                <span className="tree__label">{t.kinds[kind].many}</span>
                <span className="tree__count">{list.length || ''}</span>
                {dot(kind)}
              </NavLink>
              <IconButton size="sm" icon="plus" label={t.kinds[kind].new_} onClick={() => add(kind)} />
            </div>
            {open ? (
              <ul className="tree__items">
                {list.map((it, i) => (
                  <li key={i}>
                    <NavLink to={`${base}/${kind}/${i}`} className="tree__item">
                      <ItemThumb kind={kind} item={it} assets={pkg.assets} scale={0.24} />
                      <span className="tree__label">{it?.name || it?.key || '—'}</span>
                      {dot(`${kind}[${i}]`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      <p className="tree__group">{t.workspace.tools}</p>
      {tool('/art', 'palette', t.workspace.sections.art, Object.keys(pkg.assets ?? {}).length)}
      {tool('/translations', 'translate', t.workspace.sections.translations)}
      {tool('/package', 'package', t.workspace.sections.package)}
      {tool('/test', 'flask', t.workspace.sections.test)}
      {tool('/publish', 'rocket', t.workspace.sections.publish)}
      <div className="tree__foot">
        <NavLink to="/reference" className="tree__link" target="_blank">
          <Icon name="book" size={17} />
          <span className="tree__label">{t.app.reference}</span>
          <Icon name="external" size={13} />
        </NavLink>
      </div>
    </nav>
  );
}

function ProblemsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { issues, errors, warnings } = useProject();
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const shown = useMemo(() => (filter === 'all' ? issues : issues.filter((i) => i.level === filter)), [issues, filter]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside className="drawer" aria-label={t.workspace.problems_title}>
      <header className="drawer__head">
        <h2>{t.workspace.problems_title}</h2>
        <div className="drawer__filters" role="radiogroup" aria-label={t.workspace.problems_title}>
          {(['all', 'error', 'warning'] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? t.workspace.filter_all : f === 'error' ? `${t.workspace.filter_errors} ${errors}` : `${t.workspace.filter_warnings} ${warnings}`}
            </button>
          ))}
        </div>
        <IconButton icon="x" label={t.common.close} onClick={onClose} />
      </header>
      <p className="drawer__note">{t.workspace.problems_note}</p>
      {shown.length ? <ProblemList issues={shown} /> : <Empty icon="check" title={t.workspace.problems_none} />}
    </aside>
  );
}

function Shell() {
  const { t } = useI18n();
  const { undo, redo } = useProject();
  const toast = useToast();
  const [problems, setProblems] = useState(false);
  use_hotkeys({
    'mod+z': (e) => { if (!(e.target as HTMLElement)?.closest?.('.studio')) { e.preventDefault(); undo(); } },
    'mod+shift+z': (e) => { if (!(e.target as HTMLElement)?.closest?.('.studio')) { e.preventDefault(); redo(); } },
    'mod+y': (e) => { e.preventDefault(); redo(); },
    'mod+s': (e) => { e.preventDefault(); toast(t.workspace.saved, 'ok'); },
  });
  return (
    <div className="ws">
      <a className="skip" href="#main">{t.app.skip}</a>
      <TopBar onProblems={() => setProblems((p) => !p)} />
      <div className="ws__body">
        <Tree />
        <main id="main" className="ws__main" tabIndex={-1}>
          <Outlet />
        </main>
        <ProblemsPanel open={problems} onClose={() => setProblems(false)} />
      </div>
    </div>
  );
}

