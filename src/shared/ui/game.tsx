// The game's own look, drawn from the game's files (served by the game at
// /play/: its sprite sheets and its font; never copied here): a cell of a
// sprite sheet, a card's picture (the game's art or a mod's image), a blind's
// chip, a tag, and text in the game's markup and colours.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { GAME_URL } from '@/shared/config';
import { loc_colour, parse_line, TEXT_DARK } from '@/shared/lib/mod';

/** a sprite sheet: its file, its cell at 1x, cells across and down */
export interface Atlas { file: string; px: number; py: number; cols: number; rows: number; frames?: number }

const sheet = (file: string, cols: number, rows: number, px = 71, py = 95): Atlas => ({ file, px, py, cols, rows });
export const ATLASES: Record<string, Atlas> = {
  Joker: sheet('Jokers.png', 10, 16),
  Tarot: sheet('Tarots.png', 10, 6),
  Planet: sheet('Tarots.png', 10, 6),
  Spectral: sheet('Tarots.png', 10, 6),
  Voucher: sheet('Vouchers.png', 9, 4),
  centers: sheet('Enhancers.png', 7, 5),
  cards_1: sheet('8BitDeck.png', 13, 4),
  stickers: sheet('stickers.png', 5, 3),
  Booster: sheet('boosters.png', 4, 9),
  tags: sheet('tags.png', 6, 5, 34, 34),
  blind_chips: { ...sheet('BlindChips.png', 21, 31, 34, 34), frames: 21 },
};
const TEXTURES = () => `${GAME_URL}/resources/textures/2x`;

/** one cell of a sheet; `scale` 1 is the game's 1x size (71 x 95 for a card) */
export function Sprite({ atlas, x, y, scale = 1, className, title, animate }: {
  atlas: string; x: number; y: number; scale?: number; className?: string; title?: string; animate?: boolean;
}) {
  const a = ATLASES[atlas];
  if (!a) return <span className={['sprite sprite--missing', className ?? ''].join(' ')} style={{ width: 71 * scale, height: 95 * scale }} />;
  const w = a.px * scale;
  const h = a.py * scale;
  const style: CSSProperties = {
    width: w, height: h,
    backgroundImage: `url("${TEXTURES()}/${a.file}")`,
    backgroundSize: `${a.cols * w}px ${a.rows * h}px`,
    backgroundPosition: `${-x * w}px ${-y * h}px`,
  };
  if (animate && a.frames) Object.assign(style, { '--frames-w': `${-a.frames * w}px`, '--row-y': `${-y * h}px` });
  return <span className={['sprite', animate && a.frames ? 'sprite--anim' : '', className ?? ''].filter(Boolean).join(' ')} style={style} title={title} role={title ? 'img' : undefined} aria-label={title} />;
}

/** what a card's picture is: a mod's image (a data URL), a cell of the game's art, or nothing (the default) */
export type CardPicture = { image: string } | { atlas: string; x: number; y: number } | null;

/** a card's picture, 71 x 95 at scale 1 */
export function CardArt({ picture, scale = 1, className, title, edition }: {
  picture: CardPicture; scale?: number; className?: string; title?: string; edition?: string | null;
}) {
  const w = 71 * scale;
  const h = 95 * scale;
  const cls = ['card-art', edition ? `card-art--${edition}` : '', className ?? ''].filter(Boolean).join(' ');
  let inner: ReactNode;
  if (picture && 'image' in picture) inner = <img src={picture.image} alt="" width={w} height={h} draggable={false} />;
  else if (picture) inner = <Sprite atlas={picture.atlas} x={picture.x} y={picture.y} scale={scale} />;
  else inner = <span className="card-art__blank" />;
  return (
    <span className={cls} style={{ width: w, height: h }} title={title} role={title ? 'img' : undefined} aria-label={title}>
      {inner}
      {edition ? <span className="card-art__edition" aria-hidden /> : null}
    </span>
  );
}

/** a blind's chip (the game's sheet: one row per blind, 21 frames), turning as in the game */
export function BlindChip({ x = 0, y, scale = 1, colour, title }: { x?: number; y: number; scale?: number; colour?: string; title?: string }) {
  return (
    <span className="blind-chip" style={colour ? ({ '--chip': colour } as CSSProperties) : undefined}>
      <Sprite atlas="blind_chips" x={x} y={y} scale={scale} animate title={title} />
    </span>
  );
}

// ------------------------------------------------------------------ the game's font
let font_loading: Promise<boolean> | null = null;

/** loads the game's font (m6x11plus, from the game's files) once; texts fall back to a monospace until then */
export function use_game_font(): boolean {
  const [ready, setReady] = useState(() => document.fonts?.check?.('16px m6x11plus') ?? false);
  useEffect(() => {
    if (ready) return;
    font_loading = font_loading ?? (async () => {
      try {
        const face = new FontFace('m6x11plus', `url("${GAME_URL}/resources/fonts/m6x11plus.ttf")`);
        document.fonts.add(await face.load());
        return true;
      } catch {
        return false;
      }
    })();
    let alive = true;
    void font_loading.then((ok) => { if (alive && ok) setReady(true); });
    return () => { alive = false; };
  }, [ready]);
  return ready;
}

// ------------------------------------------------------------------ text
/** a description's lines in the game's markup: colours ({C:mult}), boxes ({X:mult,C:white}), sizes, tooltips,
 * and the values (#1# ...) filled in; `tooltip` names a key (T:...) for its hover text */
export function GameText({ lines, vars, light, tooltip, className }: {
  lines: string[]; vars?: string[]; light?: boolean; tooltip?: (key: string) => string | undefined; className?: string;
}) {
  const fallback = light ? '#ffffff' : TEXT_DARK;
  const rows = lines.map((line) => parse_line(line)).filter((r): r is NonNullable<typeof r> => r !== null);
  return (
    <span className={['game-text', className ?? ''].filter(Boolean).join(' ')}>
      {rows.map((parts, i) => (
        <span className="game-text__line" key={i}>
          {parts.map((part, k) => {
            const text = part.strings.map((s) => (typeof s === 'number' ? (vars?.[s - 1] ?? 'ERROR') : s)).join('');
            const c = part.control;
            const scale = c.s ? Number(c.s) || 1 : 1;
            const style: CSSProperties = { fontSize: scale !== 1 ? `${scale}em` : undefined };
            const classes = ['game-text__part', c.E === '1' ? 'is-float' : c.E === '2' ? 'is-bump' : '', c.T ? 'has-tip' : ''].filter(Boolean).join(' ');
            const title = c.T ? (tooltip?.(c.T) ?? c.T) : undefined;
            if (c.X !== undefined) {
              return (
                <span key={k} className={`${classes} game-text__box`} title={title}
                  style={{ ...style, background: loc_colour(c.X), color: loc_colour(c.C) }}>{text}</span>
              );
            }
            return <span key={k} className={classes} title={title} style={{ ...style, color: loc_colour(c.C, fallback) }}>{text}</span>;
          })}
        </span>
      ))}
    </span>
  );
}
