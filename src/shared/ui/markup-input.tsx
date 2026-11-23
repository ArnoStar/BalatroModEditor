// A description's text in the game's markup: one line per line of the card's
// box, its parts shown in their own colours as they are typed, and a toolbar
// that wraps the selection in a colour, a box or a bigger size, or puts a
// value (#1#) or a tooltip in.
import { useRef, type ReactNode } from 'react';
import { COLOUR_NAMES, loc_colour, markup_tokens } from '@/shared/lib/mod';
import { useI18n } from '@/shared/i18n';
import { Button } from './controls';
import { Menu, type MenuItem } from './overlays';

/** each part of the source in the colour the game gives it (a light default: the editor is dark) */
function Highlight({ line }: { line: string }) {
  const toks = markup_tokens(line);
  // the controls in force for the text that follows them (as the game reads them)
  let control: Record<string, string> = {};
  const out: ReactNode[] = [];
  toks.forEach((tk, i) => {
    if (tk.kind === 'control') {
      control = {};
      const body = tk.text.replace(/^\{|\}$/g, '');
      for (const pair of body.split(',')) {
        const [k, v] = pair.split(':');
        if (k && v !== undefined) control[k] = v;
      }
      out.push(<span key={i} className="mk-control">{tk.text}</span>);
      return;
    }
    if (tk.kind === 'var') {
      out.push(<span key={i} className="mk-var">{tk.text}</span>);
      return;
    }
    const colour = control.C ? loc_colour(control.C, 'inherit') : 'inherit';
    const box = control.X ? loc_colour(control.X) : undefined;
    out.push(
      <span key={i} className={box ? 'mk-text mk-box' : 'mk-text'} style={{ color: colour === '#4f6367' ? 'inherit' : colour, background: box }}>{tk.text}</span>,
    );
  });
  return <>{out}</>;
}

export function MarkupInput({ lines, onChange, vars, tooltip_items, id, describedby, label, placeholder }: {
  lines: string[];
  onChange: (lines: string[]) => void;
  /** the values the text can show (#1# …): what each one is */
  vars: string[];
  /** cards and tags a tooltip can show ({T:key}) */
  tooltip_items?: MenuItem[] | ((insert: (key: string) => void) => MenuItem[]);
  id?: string;
  describedby?: string;
  label?: string;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const area = useRef<HTMLTextAreaElement>(null);
  const text = lines.join('\n');

  const set_text = (next: string, sel?: [number, number]) => {
    onChange(next.split('\n'));
    if (sel) requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(sel[0], sel[1]); });
  };

  /** wrap the selection (each line of it) in `open` … `close` */
  const wrap = (open: string, close = '{}') => {
    const el = area.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const sel = text.slice(a, b);
    const wrapped = sel ? sel.split('\n').map((s) => (s ? open + s + close : s)).join('\n') : open + close;
    const next = text.slice(0, a) + wrapped + text.slice(b);
    const caret = sel ? a + wrapped.length : a + open.length;
    set_text(next, sel ? [a, a + wrapped.length] : [caret, caret]);
  };

  const insert = (s: string) => {
    const el = area.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    set_text(text.slice(0, a) + s + text.slice(b), [a + s.length, a + s.length]);
  };

  const plain = () => {
    const el = area.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    if (a === b) return;
    const stripped = text.slice(a, b).replace(/\{[^}]*\}/g, '');
    set_text(text.slice(0, a) + stripped + text.slice(b), [a, a + stripped.length]);
  };

  const colour_items: MenuItem[] = COLOUR_NAMES.map((c) => ({
    label: t.markup.colours[c] ?? c, hint: `{C:${c}}`, swatch: loc_colour(c), onSelect: () => wrap(`{C:${c}}`),
  }));
  const box_items: MenuItem[] = [
    { label: t.markup.box_mult, hint: '{X:mult,C:white}', swatch: loc_colour('mult'), onSelect: () => wrap('{X:mult,C:white}') },
    { label: t.markup.box_chips, hint: '{X:chips,C:white}', swatch: loc_colour('chips'), onSelect: () => wrap('{X:chips,C:white}') },
    ...['money', 'attention', 'green', 'tarot', 'planet', 'spectral'].map((c) => ({
      label: t.markup.colours[c] ?? c, hint: `{X:${c},C:white}`, swatch: loc_colour(c), onSelect: () => wrap(`{X:${c},C:white}`),
    })),
  ];
  const var_items: MenuItem[] = vars.map((v, i) => ({ label: `#${i + 1}#`, hint: v || '—', onSelect: () => insert(`#${i + 1}#`) }));
  const tips = typeof tooltip_items === 'function' ? tooltip_items((key) => wrap(`{C:attention,T:${key}}`)) : tooltip_items;

  return (
    <div className="markup">
      <div className="markup__bar" role="toolbar" aria-label={t.markup.help}>
        <Menu label={t.markup.colour} items={colour_items} width={240} trigger={(p) => <Button size="sm" tone="ghost" icon="palette" {...p}>{t.markup.colour}</Button>} />
        <Menu label={t.markup.box} items={box_items} width={240} trigger={(p) => <Button size="sm" tone="ghost" icon="square" {...p}>{t.markup.box}</Button>} />
        <Button size="sm" tone="ghost" onClick={() => wrap('{s:1.1}')}>{t.markup.size}</Button>
        {var_items.length ? (
          <Menu label={t.markup.value} items={var_items} width={260} trigger={(p) => <Button size="sm" tone="ghost" {...p}># {t.markup.value}</Button>} />
        ) : null}
        {tips?.length ? (
          <Menu label={t.markup.tooltip_pick} items={tips} width={300} trigger={(p) => <Button size="sm" tone="ghost" icon="info" {...p}>{t.markup.tooltip}</Button>} />
        ) : null}
        <Button size="sm" tone="ghost" onClick={plain}>{t.markup.plain}</Button>
      </div>
      <div className="markup__box">
        <pre className="markup__hl" aria-hidden>
          {lines.map((l, i) => <span key={i} className="markup__line"><Highlight line={l} />{i < lines.length - 1 ? '\n' : ''}</span>)}
          {'\n'}
        </pre>
        <textarea ref={area} id={id} className="markup__input" value={text} spellCheck autoComplete="off" aria-describedby={describedby}
          aria-label={label} placeholder={placeholder} rows={Math.max(2, lines.length)} onChange={(e) => set_text(e.target.value)} />
      </div>
    </div>
  );
}
