// The project being edited, for every part of the editor: its package, every
// change to it (undone and redone, typing grouped into one step), saved to
// this browser as it changes, and its problems, checked on every change.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode,
} from 'react';
import { check_package, get_in, path_str, set_in, type Issue, type KnownKeys, type ModPackage, type Path } from '@/shared/lib/mod';
import { save_project } from './store';
import type { ArtSource, Project, Published } from './types';

export interface Snap { pkg: ModPackage; art: Record<string, ArtSource> }
type SnapFn = (s: Snap) => Snap;
interface History { current: Project; past: Snap[]; future: Snap[]; last: { key: string; at: number } | null }

type Act =
  | { type: 'change'; f: SnapFn; coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'meta'; f: (p: Project) => Project };

const LIMIT = 300;
const GROUP_MS = 1200;

function reducer(h: History, a: Act): History {
  const snap: Snap = { pkg: h.current.pkg, art: h.current.art };
  switch (a.type) {
    case 'change': {
      const next = a.f(snap);
      if (next.pkg === snap.pkg && next.art === snap.art) return h;
      const now = Date.now();
      const grouped = a.coalesce !== undefined && h.last?.key === a.coalesce && now - h.last.at < GROUP_MS;
      return {
        current: { ...h.current, pkg: next.pkg, art: next.art },
        past: grouped ? h.past : [...h.past.slice(-LIMIT + 1), snap],
        future: [],
        last: a.coalesce !== undefined ? { key: a.coalesce, at: now } : null,
      };
    }
    case 'undo': {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      return { current: { ...h.current, ...prev }, past: h.past.slice(0, -1), future: [snap, ...h.future], last: null };
    }
    case 'redo': {
      const next = h.future[0];
      if (!next) return h;
      return { current: { ...h.current, ...next }, past: [...h.past, snap], future: h.future.slice(1), last: null };
    }
    case 'meta':
      return { ...h, current: a.f(h.current) };
  }
}

export type SaveStatus = 'saved' | 'saving' | 'error';

/** what the server's check said, for the package it checked */
export interface ServerCheck { pkg: ModPackage; valid: boolean; errors: string[]; hash: string | null; at: number }

export interface ProjectValue {
  project: Project;
  pkg: ModPackage;
  /** change the package (and the drawings); `coalesce`: changes with the same key in a row are one undo step */
  change(f: (pkg: ModPackage) => ModPackage, coalesce?: string): void;
  /** change the package and the drawings together */
  change_all(f: SnapFn, coalesce?: string): void;
  /** set one place of the package (undefined removes it); typing into it is one undo step */
  set(path: Path, value: unknown): void;
  get(path: Path): any;
  undo(): void;
  redo(): void;
  can_undo: boolean;
  can_redo: boolean;
  save_status: SaveStatus;
  set_published(p: Published): void;
  issues: Issue[];
  errors: number;
  warnings: number;
  /** the problems at exactly this place */
  issues_at(path: string): Issue[];
  /** the problems at this place and inside it */
  issues_under(path: string): Issue[];
  server: ServerCheck | null;
  set_server(c: ServerCheck | null): void;
}

const ProjectContext = createContext<ProjectValue | null>(null);

const inside = (p: string, prefix: string) => prefix === '' || p === prefix || p.startsWith(prefix + '.') || p.startsWith(prefix + '[');

export function ProjectProvider({ initial, known, children }: { initial: Project; known: KnownKeys; children: ReactNode }) {
  const [h, dispatch] = useReducer(reducer, initial, (p) => ({ current: p, past: [], future: [], last: null }));
  const [save_status, setSaveStatus] = useState<SaveStatus>('saved');
  const [server, setServer] = useState<ServerCheck | null>(null);
  const project = h.current;

  // ---- saving: a moment after the last change, and when the page goes away
  const pending = useRef<Project | null>(null);
  const first = useRef(true);
  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    try {
      await save_project(p);
      if (!pending.current) setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pending.current = { ...project, updated_at: Date.now() };
    setSaveStatus('saving');
    const id = setTimeout(() => void flush(), 500);
    return () => clearTimeout(id);
  }, [project, flush]);
  useEffect(() => {
    const away = () => void flush();
    window.addEventListener('pagehide', away);
    return () => { window.removeEventListener('pagehide', away); void flush(); };
  }, [flush]);

  const issues = useMemo(() => check_package(project.pkg, known), [project.pkg, known]);
  const index = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of issues) { const l = m.get(i.path); if (l) l.push(i); else m.set(i.path, [i]); }
    return m;
  }, [issues]);

  const change = useCallback((f: (pkg: ModPackage) => ModPackage, coalesce?: string) =>
    dispatch({ type: 'change', f: (s) => ({ ...s, pkg: f(s.pkg) }), coalesce }), []);
  const change_all = useCallback((f: SnapFn, coalesce?: string) => dispatch({ type: 'change', f, coalesce }), []);
  const set = useCallback((path: Path, value: unknown) =>
    dispatch({ type: 'change', f: (s) => ({ ...s, pkg: set_in(s.pkg, path, value) }), coalesce: path_str(path) }), []);
  const pkg_ref = useRef(project.pkg);
  pkg_ref.current = project.pkg;
  const get = useCallback((path: Path) => get_in(pkg_ref.current, path), []);

  const value = useMemo<ProjectValue>(() => ({
    project,
    pkg: project.pkg,
    change,
    change_all,
    set,
    get,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    can_undo: h.past.length > 0,
    can_redo: h.future.length > 0,
    save_status,
    set_published: (p) => dispatch({ type: 'meta', f: (x) => ({ ...x, published: p }) }),
    issues,
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
    issues_at: (path) => index.get(path) ?? [],
    issues_under: (path) => issues.filter((i) => inside(i.path, path)),
    server,
    set_server: setServer,
  }), [project, change, change_all, set, get, h.past.length, h.future.length, save_status, issues, index, server]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectValue {
  const v = useContext(ProjectContext);
  if (!v) throw new Error('useProject outside ProjectProvider');
  return v;
}
