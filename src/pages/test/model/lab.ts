// The scoring lab's run: a real run of the engine (the API's), started with
// the mod and Creative mode; every action and creative change goes to the
// server, and what the game showed happen (its feedback events) is kept, step
// by step, with the names of the cards it names.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  games_api, ProblemError, type CardView, type CreativeCommand, type GameEvent, type GameView, type HandPreview, type ModChoice,
  type PlayerAction,
} from '@/shared/api';
import { logic, type ModPackage } from '@/shared/lib/mod';

export interface LogEntry { id: number; title: string; events: GameEvent[]; names: Record<number, string> }

const SUIT = { Spades: '♠', Hearts: '♥', Clubs: '♣', Diamonds: '♦' } as Record<string, string>;
const RANK = { Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A' } as Record<string, string>;
export const card_label = (c: CardView) =>
  c.kind === 'playing_card' && c.rank && c.suit ? `${RANK[c.rank] ?? c.rank}${SUIT[c.suit] ?? c.suit}` : c.name ?? c.key ?? `#${c.id}`;

function names_of(g: GameView | null): Record<number, string> {
  const out: Record<number, string> = {};
  if (!g) return out;
  for (const c of [...g.hand, ...g.jokers, ...g.consumables, ...(g.shop?.jokers ?? []), ...(g.shop?.vouchers ?? []), ...(g.shop?.boosters ?? []), ...(g.pack?.cards ?? [])]) {
    out[c.id] = card_label(c);
  }
  return out;
}

const KEY = 'balatro-editor.lab';

export function use_lab(project_id: string, pkg: ModPackage) {
  const [game, setGame] = useState<GameView | null>(null);
  const [started, setStarted] = useState<ModPackage | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [preview, setPreview] = useState<HandPreview | null>(null);
  const next = useRef(1);
  const game_ref = useRef<GameView | null>(null);
  game_ref.current = game;

  // the run open for this project in this tab: picked up again after a reload
  useEffect(() => {
    const saved = sessionStorage.getItem(`${KEY}.${project_id}`);
    if (!saved) return;
    games_api.get(saved).then((g) => { setGame(g); setStarted(null); }, () => sessionStorage.removeItem(`${KEY}.${project_id}`));
  }, [project_id]);

  const record = useCallback((title: string, before: GameView | null, after: GameView, events: GameEvent[]) => {
    const names = { ...names_of(before), ...names_of(after) };
    for (const e of events) {
      const v = (e as { view?: CardView | null }).view;
      if (v) names[v.id] = card_label(v);
    }
    setLog((l) => [{ id: next.current++, title, events, names }, ...l].slice(0, 60));
  }, []);

  const run = useCallback(async <T,>(f: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try { return await f(); } catch (e) { setError(e); return null; } finally { setBusy(false); }
  }, []);

  const start = useCallback((deck: string, seed: string) => run(async () => {
    const old = game_ref.current;
    if (old) { await games_api.remove(old.id).catch(() => undefined); }
    const mods: ModChoice[] = [{ package: logic(pkg as unknown as Record<string, unknown>) as never }];
    if (!pkg.creative && pkg.id !== 'creative') mods.push({ id: 'creative' });
    let g = await games_api.create({ seed: seed.trim() || null, deck, stake: 1, mods });
    if (g.phase === 'blind_select') g = (await games_api.act(g.id, { type: 'select_blind', expected_version: g.version } as PlayerAction & { expected_version: number })).game;
    sessionStorage.setItem(`${KEY}.${project_id}`, g.id);
    setGame(g);
    setStarted(pkg);
    setLog([]);
    setSelected([]);
    setPreview(null);
  }), [pkg, project_id, run]);

  const act = useCallback((action: PlayerAction, title: string) => run(async () => {
    const g = game_ref.current;
    if (!g) return;
    const r = await games_api.act(g.id, { ...action, expected_version: g.version } as PlayerAction & { expected_version: number });
    record(title, g, r.game, r.events);
    setGame(r.game);
    setSelected([]);
    setPreview(null);
  }), [record, run]);

  const creative = useCallback((cmd: CreativeCommand, title: string) => run(async () => {
    const g = game_ref.current;
    if (!g) return;
    const r = await games_api.creative(g.id, { ...cmd, expected_version: g.version });
    if (r.events.length) record(title, g, r.game, r.events);
    setGame(r.game);
    setSelected((s) => s.filter((id) => r.game.hand.some((c) => c.id === id)));
  }), [record, run]);

  const end = useCallback(() => run(async () => {
    const g = game_ref.current;
    if (g) await games_api.remove(g.id).catch((e) => { if (!(e instanceof ProblemError && e.status === 404)) throw e; });
    sessionStorage.removeItem(`${KEY}.${project_id}`);
    setGame(null);
    setStarted(null);
    setLog([]);
    setSelected([]);
    setPreview(null);
  }), [project_id, run]);

  // what the selected cards make (the game's own preview)
  useEffect(() => {
    const g = game_ref.current;
    if (!g || !selected.length || g.phase !== 'playing') { setPreview(null); return; }
    let alive = true;
    const id = setTimeout(() => {
      games_api.preview(g.id, selected).then((p) => { if (alive) setPreview(p); }, () => undefined);
    }, 120);
    return () => { alive = false; clearTimeout(id); };
  }, [selected, game?.version]);

  const toggle = useCallback((id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id])), []);

  return {
    game, started, stale: started !== null && started !== pkg, log, busy, error, selected, preview,
    start, act, creative, end, toggle, clear_log: () => setLog([]), set_error: setError,
  };
}

export type Lab = ReturnType<typeof use_lab>;
