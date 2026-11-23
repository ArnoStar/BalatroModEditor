// The drawing studio: a card's picture, pixel by pixel, at the game's 1x size
// (71 x 95, doubled when saved, as the game's own art) or at 142 x 190.
// Layers, a pencil, an eraser, a fill, lines, rectangles and ellipses, a
// mirror, a colour picker, the game's colours, and a game card to trace over
// or start from. Keys: B E G L R O I M, [ ] brush, Ctrl/⌘+Z.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { PickItem } from '@/entities/catalog';
import type { ArtSource } from '@/entities/project';
import { GAME_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { ASSET_W, CARD_H, CARD_W, data_url_bytes, image_pixels, is_doubled, load_image } from '@/shared/lib';
import { ASSET_NAME, MAX_ASSET_BYTES } from '@/shared/lib/mod';
import {
  ATLASES, Button, Field, Icon, IconButton, Menu, Segmented, Select, Sprite, TextInput, Toggle, useConfirm, type IconName,
} from '@/shared/ui';
import {
  card_template, ellipse, export_png, fill, flatten, flipped, from_hex, hex_of, layer, layer_png, line, pack, pixels_of, put, rect,
  shifted, unpack, type Doc, type Layer,
} from '../model/doc';

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'ellipse' | 'picker' | 'move';
const TOOLS: { tool: Tool; icon: IconName; key: string }[] = [
  { tool: 'pencil', icon: 'pencil', key: 'b' }, { tool: 'eraser', icon: 'eraser', key: 'e' }, { tool: 'fill', icon: 'bucket', key: 'g' },
  { tool: 'line', icon: 'line', key: 'l' }, { tool: 'rect', icon: 'square', key: 'r' }, { tool: 'ellipse', icon: 'circle', key: 'o' },
  { tool: 'picker', icon: 'pipette', key: 'i' }, { tool: 'move', icon: 'move', key: 'm' },
];

/** the game's colours (G.C): what its cards are painted with */
const GAME_COLOURS = [
  '#ffffff', '#fdf8f0', '#e8e4dc', '#bfc7d5', '#b8d8d8', '#7a9e9f', '#5f7377', '#4f6367', '#374244', '#1e2b2d', '#000000',
  '#fe5f55', '#f03464', '#e2574c', '#b44430', '#ff9a00', '#fda200', '#f3b958', '#eac058', '#b18f43', '#cb724c', '#fd682b',
  '#4bc292', '#56a887', '#4ca893', '#235955', '#13afce', '#009dff', '#4584fa', '#646eb7', '#4f5da1', '#403995',
  '#8867a5', '#a782d1', '#b26cbb', '#c75985', '#8389dd', '#f06b3f',
];

interface Snapshot { layers: Layer[] }

export interface StudioResult { name: string; png: string; source: ArtSource }

export function ArtStudio({ name: initial_name, source, image, taken, onSave, onCancel, trace_items }: {
  name: string;
  source?: ArtSource;
  image?: string;
  /** the image names already in the mod (not this one) */
  taken: string[];
  onSave: (r: StudioResult) => void;
  onCancel?: () => void;
  /** the cards that can be traced over or copied (the game's) */
  trace_items?: PickItem[];
}) {
  const { t } = useI18n();
  const ts = t.art.studio;
  const confirm = useConfirm();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<Tool>('pencil');
  const [colour, setColour] = useState(pack(79, 99, 103));
  const [alpha, setAlpha] = useState(255);
  const [recent, setRecent] = useState<number[]>([]);
  const [size, setSize] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [filled, setFilled] = useState(false);
  const [grid, setGrid] = useState(true);
  const [zoom, setZoom] = useState(6);
  const [name, setName] = useState(initial_name);
  const [trace, setTrace] = useState<{ atlas: string; x: number; y: number } | null>(null);
  const [trace_opacity, setTraceOpacity] = useState(0.35);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [preview, setPreview] = useState<{ index: number; px: Uint32Array } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; last: [number, number]; base: Uint32Array; work: Uint32Array } | null>(null);

  // ---- open: the saved layers, or the image (at 1x if it is a doubled 1x picture), or a blank card
  useEffect(() => {
    let alive = true;
    (async () => {
      let d: Doc;
      if (source?.layers.length) {
        const layers = await Promise.all(source.layers.map(async (l) => ({ ...layer(source.w, source.h, l.name, await pixels_of(l.png, source.w, source.h)), visible: l.visible, opacity: l.opacity })));
        d = { w: source.w, h: source.h, layers };
      } else if (image) {
        const data = await image_pixels(image);
        const half = is_doubled(data) && data.width === ASSET_W;
        const w = half ? CARD_W : data.width === CARD_W ? CARD_W : ASSET_W;
        const h = Math.round((w / CARD_W) * CARD_H);
        d = { w, h, layers: [layer(w, h, ts.layer(1), await pixels_of(image, w, h))] };
      } else {
        d = { w: CARD_W, h: CARD_H, layers: [layer(CARD_W, CARD_H, ts.layer(1), card_template(CARD_W, CARD_H, pack(255, 255, 255), pack(79, 99, 103)))] };
      }
      if (alive) { setDoc(d); setActive(d.layers.length - 1); setZoom(d.w > CARD_W ? 3 : 6); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, image]);

  // ---- drawing on screen
  const composite = useMemo(() => (doc ? flatten(doc, preview ?? undefined) : null), [doc, preview]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !doc || !composite) return;
    c.width = doc.w;
    c.height = doc.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(doc.w, doc.h);
    new Uint32Array(img.data.buffer).set(composite);
    ctx.putImageData(img, 0, 0);
  }, [doc, composite]);
  useEffect(() => {
    const o = overlay.current;
    if (!o || !doc) return;
    o.width = doc.w * zoom;
    o.height = doc.h * zoom;
    const ctx = o.getContext('2d')!;
    ctx.clearRect(0, 0, o.width, o.height);
    if (grid && zoom >= 5) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < doc.w; x++) { ctx.moveTo(x * zoom + 0.5, 0); ctx.lineTo(x * zoom + 0.5, o.height); }
      for (let y = 1; y < doc.h; y++) { ctx.moveTo(0, y * zoom + 0.5); ctx.lineTo(o.width, y * zoom + 0.5); }
      ctx.stroke();
    }
    if (mirror) {
      ctx.strokeStyle = 'rgba(155,123,255,0.55)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo((doc.w / 2) * zoom, 0);
      ctx.lineTo((doc.w / 2) * zoom, o.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (hover) {
      const half = Math.floor((size - 1) / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeRect((hover[0] - half) * zoom + 0.5, (hover[1] - half) * zoom + 0.5, size * zoom - 1, size * zoom - 1);
    }
  }, [doc, zoom, grid, mirror, hover, size]);

  // ---- history (the studio's own: the mod's undo takes the saved picture)
  const snapshot = useCallback((): Snapshot => ({ layers: doc!.layers.map((l) => ({ ...l, px: l.px.slice() })) }), [doc]);
  const commit = useCallback((layers: Layer[], before: Snapshot) => {
    setPast((p) => [...p.slice(-59), before]);
    setFuture([]);
    setDoc((d) => (d ? { ...d, layers } : d));
    setDirty(true);
  }, []);
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev || !doc) return;
    setFuture((f) => [snapshot(), ...f]);
    setPast((p) => p.slice(0, -1));
    setDoc({ ...doc, layers: prev.layers });
    setActive((a) => Math.min(a, prev.layers.length - 1));
    setDirty(true);
  };
  const redo = () => {
    const next = future[0];
    if (!next || !doc) return;
    setPast((p) => [...p, snapshot()]);
    setFuture((f) => f.slice(1));
    setDoc({ ...doc, layers: next.layers });
    setDirty(true);
  };
  const change_layer = (f: (px: Uint32Array) => Uint32Array | void) => {
    if (!doc) return;
    const before = snapshot();
    const layers = doc.layers.map((l, i) => {
      if (i !== active) return l;
      const px = l.px.slice();
      const r = f(px);
      return { ...l, px: r ?? px };
    });
    commit(layers, before);
  };
  const change_layers = (f: (layers: Layer[]) => Layer[]) => {
    if (!doc) return;
    commit(f(doc.layers), snapshot());
  };

  const paint = tool === 'eraser' ? 0 : ((colour & 0x00ffffff) | (alpha << 24)) >>> 0;
  const remember = (c: number) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 12));

  // ---- pointer
  const at = (e: RPointerEvent): [number, number] | null => {
    const c = canvas.current;
    if (!c || !doc) return null;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * doc.w);
    const y = Math.floor(((e.clientY - r.top) / r.height) * doc.h);
    return [x, y];
  };
  const inside = (p: [number, number]) => !!doc && p[0] >= 0 && p[1] >= 0 && p[0] < doc.w && p[1] < doc.h;
  const down = (e: RPointerEvent) => {
    if (!doc) return;
    const p = at(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const l = doc.layers[active];
    if (!l) return;
    if (tool === 'picker') {
      if (!inside(p)) return;
      const c = flatten(doc)[p[1] * doc.w + p[0]];
      if (c >>> 24) { setColour(c); setAlpha(c >>> 24); remember(c); }
      setTool('pencil');
      return;
    }
    if (tool === 'fill') {
      if (!inside(p)) return;
      change_layer((px) => fill(px, doc.w, doc.h, p[0], p[1], paint));
      if (paint) remember(paint);
      return;
    }
    const base = l.px.slice();
    const work = base.slice();
    drag.current = { x: p[0], y: p[1], last: p, base, work };
    if (tool === 'pencil' || tool === 'eraser') {
      put(work, doc.w, doc.h, p[0], p[1], paint, size, mirror);
      setPreview({ index: active, px: work.slice() });
    }
  };
  const move = (e: RPointerEvent) => {
    if (!doc) return;
    const p = at(e);
    setHover(p && inside(p) ? p : null);
    const d = drag.current;
    if (!p || !d) return;
    const w = doc.w;
    const h = doc.h;
    if (tool === 'pencil' || tool === 'eraser') {
      line(d.work, w, h, d.last[0], d.last[1], p[0], p[1], paint, size, mirror);
      d.last = p;
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      d.work = d.base.slice();
      if (tool === 'line') line(d.work, w, h, d.x, d.y, p[0], p[1], paint, size, mirror);
      else if (tool === 'rect') rect(d.work, w, h, d.x, d.y, p[0], p[1], paint, filled, size, mirror);
      else ellipse(d.work, w, h, d.x, d.y, p[0], p[1], paint, filled, size, mirror);
    } else if (tool === 'move') {
      d.work = shifted(d.base, w, h, p[0] - d.x, p[1] - d.y);
    }
    setPreview({ index: active, px: d.work.slice() });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !doc) { setPreview(null); return; }
    const before: Snapshot = { layers: doc.layers.map((l, i) => (i === active ? { ...l, px: d.base } : { ...l, px: l.px.slice() })) };
    const layers = doc.layers.map((l, i) => (i === active ? { ...l, px: d.work } : l));
    setPreview(null);
    commit(layers, before);
    if (paint && tool !== 'move') remember(paint);
  };

  // ---- keys
  const keys = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); e.stopPropagation(); redo(); return; }
    if (mod) return;
    const found = TOOLS.find((x) => x.key === e.key.toLowerCase());
    if (found) { setTool(found.tool); return; }
    if (e.key === '[') setSize((s) => Math.max(1, s - 1));
    if (e.key === ']') setSize((s) => Math.min(6, s + 1));
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(16, z + 1));
    if (e.key === '-') setZoom((z) => Math.max(2, z - 1));
  };

  // ---- starting points
  const sheet_cell = async (item: { atlas: string; x: number; y: number }): Promise<Uint32Array> => {
    const a = ATLASES[item.atlas];
    const img = await load_image(`${GAME_URL}/resources/textures/2x/${a.file}`);
    return pixels_of(img, doc!.w, doc!.h, { x: item.x * a.px * 2, y: item.y * a.py * 2, w: a.px * 2, h: a.py * 2 });
  };
  const start_from = async (what: 'blank' | 'card' | 'dark' | { atlas: string; x: number; y: number }) => {
    if (!doc) return;
    if (!(await confirm(ts.replace_confirm, { ok: t.common.apply, danger: false }))) return;
    const px = what === 'blank' ? new Uint32Array(doc.w * doc.h)
      : what === 'card' ? card_template(doc.w, doc.h, pack(255, 255, 255), pack(79, 99, 103))
        : what === 'dark' ? card_template(doc.w, doc.h, pack(55, 66, 68), pack(30, 43, 45))
          : await sheet_cell(what);
    change_layer(() => px);
  };
  const set_resolution = async (w: number) => {
    if (!doc || w === doc.w) return;
    const h = Math.round((w / CARD_W) * CARD_H);
    const layers = await Promise.all(doc.layers.map(async (l) => ({ ...l, px: await pixels_of(layer_png(l, doc.w, doc.h), w, h) })));
    setPast([]);
    setFuture([]);
    setDoc({ w, h, layers });
    setZoom(w > CARD_W ? 3 : 6);
    setDirty(true);
  };

  const png = useMemo(() => (doc ? export_png(doc) : ''), [doc]);
  const bytes = png ? data_url_bytes(png) : 0;
  const name_ok = new RegExp(ASSET_NAME).test(name) && !taken.includes(name);
  const save = () => {
    if (!doc || !name_ok || bytes > MAX_ASSET_BYTES) return;
    onSave({
      name, png,
      source: { w: doc.w, h: doc.h, layers: doc.layers.map((l) => ({ name: l.name, visible: l.visible, opacity: l.opacity, png: layer_png(l, doc.w, doc.h) })) },
    });
    setDirty(false);
  };
  const cancel = async () => {
    if (dirty && !(await confirm(ts.leave_unsaved, { ok: t.common.close }))) return;
    onCancel?.();
  };

  const traces = trace_items ?? [];
  // (one option per cell of the game's art: some cards share one)
  const trace_options = [...new Map(traces.filter((x) => x.picture && 'atlas' in x.picture).map((x) => {
    const p = x.picture as { atlas: string; x: number; y: number };
    return [`${p.atlas}:${p.x}:${p.y}`, { value: `${p.atlas}:${p.x}:${p.y}`, label: x.name }] as const;
  })).values()];
  if (!doc) return <div className="studio studio--loading"><span className="spinner spinner--lg" /></div>;
  const [r, g, b] = unpack(colour);
  return (
    <div className="studio" ref={root} tabIndex={0} onKeyDown={keys} aria-label={ts.title}>
      <div className="studio__tools" role="toolbar" aria-label={ts.title}>
        {TOOLS.map((x) => (
          <IconButton key={x.tool} icon={x.icon} label={`${ts.tools[x.tool]} (${x.key.toUpperCase()})`} active={tool === x.tool} onClick={() => setTool(x.tool)} />
        ))}
        <span className="studio__sep" />
        <IconButton icon="mirror" label={ts.mirror} active={mirror} onClick={() => setMirror((m) => !m)} />
        <IconButton icon="grid" label={ts.grid} active={grid} onClick={() => setGrid((g) => !g)} />
        <span className="studio__sep" />
        <IconButton icon="undo" label={ts.undo} disabled={!past.length} onClick={undo} />
        <IconButton icon="redo" label={ts.redo} disabled={!future.length} onClick={redo} />
      </div>

      <div className="studio__stage">
        <div className="studio__opts">
          {tool === 'rect' || tool === 'ellipse' ? <Toggle checked={filled} onChange={setFilled} label={ts.filled} /> : null}
          {tool !== 'fill' && tool !== 'picker' && tool !== 'move' ? (
            <label className="studio__range">{ts.brush} <input type="range" min={1} max={6} value={size} onChange={(e) => setSize(Number(e.target.value))} /> <b>{size}</b></label>
          ) : null}
          <span className="studio__grow" />
          <IconButton size="sm" icon="zoom-out" label={ts.zoom} onClick={() => setZoom((z) => Math.max(2, z - 1))} />
          <span className="studio__zoom">{zoom * 100}%</span>
          <IconButton size="sm" icon="zoom-in" label={ts.zoom} onClick={() => setZoom((z) => Math.min(16, z + 1))} />
          <span className="studio__pos">{hover ? ts.position(hover[0], hover[1]) : `${doc.w} × ${doc.h}`}</span>
        </div>
        <div className="studio__scroll">
          <div className="studio__paper" style={{ width: doc.w * zoom, height: doc.h * zoom }}>
            {trace ? <span className="studio__trace" style={{ opacity: trace_opacity }}><Sprite atlas={trace.atlas} x={trace.x} y={trace.y} scale={(doc.w * zoom) / 71} /></span> : null}
            <canvas ref={canvas} className="studio__canvas" style={{ width: doc.w * zoom, height: doc.h * zoom }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => setHover(null)} />
            <canvas ref={overlay} className="studio__overlay" aria-hidden />
          </div>
        </div>
      </div>

      <aside className="studio__side">
        <section className="studio__panel">
          <h3>{ts.colour}</h3>
          <div className="studio__colour">
            <input type="color" aria-label={ts.colour} value={hex_of(colour)} onChange={(e) => setColour(from_hex(e.target.value))} />
            <code>{hex_of(colour)}</code>
            <label className="studio__range">{ts.alpha} <input type="range" min={0} max={255} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} /></label>
          </div>
          <p className="studio__label">{ts.game_colours}</p>
          <div className="swatches">
            {GAME_COLOURS.map((c) => (
              <button key={c} type="button" className={hex_of(colour) === c ? 'is-on' : ''} style={{ background: c }} title={c} aria-label={c}
                onClick={() => { setColour(from_hex(c)); setAlpha(255); if (tool === 'eraser' || tool === 'picker') setTool('pencil'); }} />
            ))}
          </div>
          {recent.length ? (
            <>
              <p className="studio__label">{ts.recent}</p>
              <div className="swatches">
                {recent.map((c) => (
                  <button key={c} type="button" style={{ background: `rgba(${unpack(c).slice(0, 3).join(',')},${(c >>> 24) / 255})` }} aria-label={hex_of(c)}
                    onClick={() => { setColour(c); setAlpha(c >>> 24); }} />
                ))}
              </div>
            </>
          ) : null}
          <span className="studio__now" style={{ background: `rgba(${r},${g},${b},${alpha / 255})` }} aria-hidden />
        </section>

        <section className="studio__panel">
          <h3>{ts.layers}</h3>
          <ol className="layers">
            {[...doc.layers].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
              <li key={l.id} className={i === active ? 'is-on' : ''}>
                <button type="button" className="layers__pick" onClick={() => setActive(i)}>{l.name}</button>
                <IconButton size="sm" icon={l.visible ? 'eye' : 'eye-off'} label={l.visible ? ts.hide : ts.show}
                  onClick={() => change_layers((ls) => ls.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)))} />
                <input type="range" min={0} max={100} value={Math.round(l.opacity * 100)} aria-label={ts.opacity}
                  onChange={(e) => { const o = Number(e.target.value) / 100; setDoc((d) => d && { ...d, layers: d.layers.map((x, k) => (k === i ? { ...x, opacity: o } : x)) }); setDirty(true); }} />
              </li>
            ))}
          </ol>
          <div className="studio__row">
            <IconButton size="sm" icon="plus" label={ts.add_layer} disabled={doc.layers.length >= 8}
              onClick={() => { change_layers((ls) => [...ls.slice(0, active + 1), layer(doc.w, doc.h, ts.layer(ls.length + 1)), ...ls.slice(active + 1)]); setActive(active + 1); }} />
            <IconButton size="sm" icon="layers" label={ts.merge_down} disabled={active === 0}
              onClick={() => {
                change_layers((ls) => {
                  const merged = flatten({ w: doc.w, h: doc.h, layers: [ls[active - 1], ls[active]].map((x) => ({ ...x, visible: true })) });
                  return [...ls.slice(0, active - 1), { ...ls[active - 1], opacity: 1, px: merged }, ...ls.slice(active + 1)];
                });
                setActive(active - 1);
              }} />
            <IconButton size="sm" icon="trash" label={ts.delete_layer} disabled={doc.layers.length <= 1}
              onClick={() => { change_layers((ls) => ls.filter((_, k) => k !== active)); setActive(Math.max(0, active - 1)); }} />
            <IconButton size="sm" icon="flip-h" label={ts.flip_h} onClick={() => change_layer((px) => flipped(px, doc.w, doc.h, true))} />
            <IconButton size="sm" icon="flip-v" label={ts.flip_v} onClick={() => change_layer((px) => flipped(px, doc.w, doc.h, false))} />
            <IconButton size="sm" icon="x" label={ts.clear} onClick={() => change_layer(() => new Uint32Array(doc.w * doc.h))} />
          </div>
        </section>

        <section className="studio__panel">
          <h3>{ts.start}</h3>
          <div className="studio__row studio__row--wrap">
            <Button size="sm" tone="ghost" onClick={() => void start_from('card')}>{ts.template_card}</Button>
            <Button size="sm" tone="ghost" onClick={() => void start_from('dark')}>{ts.template_dark}</Button>
            <Button size="sm" tone="ghost" onClick={() => void start_from('blank')}>{ts.template_blank}</Button>
            {traces.length ? (
              <Menu label={ts.template_game} width={300} items={traces.slice(0, 200).map((x) => ({
                label: x.name, hint: x.key, onSelect: () => { if (x.picture && 'atlas' in x.picture) void start_from(x.picture); },
              }))} trigger={(p) => <Button size="sm" tone="ghost" icon="copy" {...p}>{ts.template_game}</Button>} />
            ) : null}
          </div>
          <Field label={ts.trace}>
            {(id) => (
              <Select<string> id={id} value={trace ? `${trace.atlas}:${trace.x}:${trace.y}` : ''}
                onChange={(v) => { if (!v) setTrace(null); else { const [atlas, x, y] = v.split(':'); setTrace({ atlas, x: Number(x), y: Number(y) }); } }}
                options={[{ value: '', label: ts.trace_none }, ...trace_options]} />
            )}
          </Field>
          {trace ? <label className="studio__range">{ts.trace_opacity} <input type="range" min={5} max={90} value={Math.round(trace_opacity * 100)} onChange={(e) => setTraceOpacity(Number(e.target.value) / 100)} /></label> : null}
          <Field label={ts.resolution}>
            {() => (
              <Segmented size="sm" label={ts.resolution} value={doc.w} onChange={(w) => void set_resolution(w)}
                options={[{ value: CARD_W, label: ts.pixel }, { value: ASSET_W, label: ts.fine }]} />
            )}
          </Field>
        </section>

        <section className="studio__panel studio__panel--save">
          <Field label={ts.name} errors={name && !name_ok ? [{ text: taken.includes(name) ? t.art.name_taken : t.art.name_bad, level: 'error' }] : undefined}>
            {(id, d) => <TextInput id={id} aria-describedby={d} mono value={name} maxLength={48} onChange={(v) => setName(v.toLowerCase())} />}
          </Field>
          <div className="studio__result">
            <img src={png} alt="" width={71} height={95} />
            <span className={bytes > MAX_ASSET_BYTES ? 'is-bad' : 'muted'}>{Math.round(bytes / 100) / 10} kB</span>
          </div>
          {bytes > MAX_ASSET_BYTES ? <p className="field__problem field__problem--error">{t.sprites.too_big}</p> : null}
          <p className={`studio__state ${dirty ? 'is-dirty' : ''}`}><Icon name={dirty ? 'info' : 'check'} size={14} />{dirty ? ts.unsaved : ts.saved}</p>
          <div className="studio__row">
            {onCancel ? <Button tone="ghost" onClick={() => void cancel()}>{t.common.close}</Button> : null}
            <Button tone="primary" icon="check" disabled={!name_ok || bytes > MAX_ASSET_BYTES} onClick={save}>{ts.save}</Button>
          </div>
        </section>
      </aside>
    </div>
  );
}
