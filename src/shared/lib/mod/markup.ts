// The game's text markup, as its descriptions use it: `{C:mult}+#1#{} Mult`,
// `{X:mult,C:white} X#1# {}`, `{C:attention,T:m_lucky}Lucky{}`. `parse_line`
// is the game's loc_parse_string (functions/misc_functions.lua) line for line;
// `LOC_COLOURS` is its loc_colour table.

export interface MarkupPart {
  /** text, and var references (#1# is the number 1) */
  strings: (string | number)[];
  /** the part's controls: C colour, X background colour, s scale, T tooltip key, E effect (1 float, 2 bump) */
  control: Record<string, string>;
}

/** One line of text, parsed as the game does (an empty line is nothing: the game drops it). */
export function parse_line(line: string): MarkupPart[] | null {
  const parsed: MarkupPart[] = [];
  let control: Record<string, string> = {};
  let in_control = false;
  let c_name: string | null = null;
  let c_val: string | null = null;
  let c_gather = false;
  let s_gather = false;
  let s_ref: string | null = null;
  let parts: (string | number | undefined)[] = [];
  let it = 0;
  const flush = () => {
    if (parts[0] !== undefined) {
      const strings: (string | number)[] = [];
      for (const p of parts) { if (p === undefined) break; strings.push(p); } // (ipairs stops at a hole)
      parsed.push({ strings, control });
    }
  };
  const chars = [...line];
  if (!chars.length) return null;
  for (const ch of chars) {
    if (ch === '{') {
      flush();
      parts = [];
      it = 0;
      control = {};
      c_name = null; c_val = null; c_gather = false;
      s_gather = false; s_ref = null;
      in_control = true;
    } else if (in_control && !(ch === ':' || ch === '}') && !c_gather) c_name = (c_name ?? '') + ch;
    else if (in_control && ch === ':') c_gather = true;
    else if (in_control && !(ch === ',' || ch === '}') && c_gather) c_val = (c_val ?? '') + ch;
    else if (in_control && (ch === ',' || ch === '}')) {
      c_gather = false;
      if (c_name !== null && c_val !== null) control[c_name] = c_val;
      c_name = null; c_val = null;
      if (ch === '}') in_control = false;
    } else if (!in_control && ch !== '#' && !s_gather) {
      const prev = parts[it];
      parts[it] = (typeof prev === 'string' ? prev : '') + (control.X !== undefined ? ch.replace(/[ \t\n\r\f\v]+/g, '') : ch);
    } else if (!in_control && ch === '#' && !s_gather) {
      s_gather = true;
      if (parts[it] !== undefined) it++;
    } else if (!in_control && ch === '#' && s_gather) {
      s_gather = false;
      if (s_ref !== null) { parts[it] = Number(s_ref); it++; s_ref = null; }
    } else if (!in_control && s_gather) s_ref = (s_ref ?? '') + ch;
  }
  flush();
  return parsed;
}

/** the game's loc_colour names and colours (G.C) */
export const LOC_COLOURS: Record<string, string> = {
  red: '#fe5f55',
  mult: '#fe5f55',
  blue: '#009dff',
  chips: '#009dff',
  green: '#4bc292',
  money: '#f3b958',
  gold: '#eac058',
  attention: '#ff9a00',
  purple: '#8867a5',
  white: '#ffffff',
  inactive: '#88888899',
  spades: '#374649',
  hearts: '#fe5f55',
  clubs: '#424e54',
  diamonds: '#fe5f55',
  tarot: '#a782d1',
  planet: '#13afce',
  spectral: '#4584fa',
  edition: 'var(--game-edition, #e8e8ff)',
  dark_edition: 'var(--game-dark-edition, #5c4c8c)',
  legendary: '#b26cbb',
  enhanced: '#8389dd',
};
export const TEXT_DARK = '#4f6367';
export const TEXT_LIGHT = '#ffffff';

/** a colour name of the markup ({C:name}): unknown names are the default (the game's dark text) */
export const loc_colour = (name: string | undefined, fallback = TEXT_DARK) => (name && LOC_COLOURS[name]) || fallback;

/** the colour names the toolbar offers, in a useful order */
export const COLOUR_NAMES = ['mult', 'chips', 'money', 'attention', 'green', 'inactive', 'tarot', 'planet', 'spectral',
  'hearts', 'diamonds', 'spades', 'clubs', 'edition', 'dark_edition', 'legendary', 'enhanced', 'purple', 'gold', 'red',
  'blue', 'white'];

/** the var numbers a line shows (#1# -> 1) */
export function vars_in(lines: string[]): Set<number> {
  const out = new Set<number>();
  for (const line of lines) {
    for (const part of parse_line(line) ?? []) for (const s of part.strings) if (typeof s === 'number' && Number.isFinite(s)) out.add(s);
  }
  return out;
}

/** a line without its markup (for lists and searches): `+#1# Mult` */
export function plain_line(line: string, vars?: unknown[]): string {
  return (parse_line(line) ?? []).map((p) => p.strings.map((s) => (typeof s === 'number' ? (vars ? String(vars[s - 1] ?? 'ERROR') : `#${s}#`) : s)).join('')).join('');
}

/** a markup token in a line (for highlighting the source) */
export interface MarkupToken { kind: 'text' | 'control' | 'var'; text: string }

/** the source split into text, {controls} and #vars# (never fails) */
export function markup_tokens(line: string): MarkupToken[] {
  const out: MarkupToken[] = [];
  const re = /(\{[^}]*\}?)|(#[^#]*#?)/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ kind: 'text', text: line.slice(last, m.index) });
    out.push({ kind: m[1] ? 'control' : 'var', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}
