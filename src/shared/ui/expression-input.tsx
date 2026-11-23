// An expression's editor: the source highlighted as it is typed, completions
// for what may be named here (the names, their fields, the functions, and the
// values a string can take: suits, hands, keys …), and what it gives on a
// sample run. The package's checks (shown by the field around it) say what is
// wrong; this marks where.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  CARD_FIELDS, EDITIONS, ENHANCEMENTS, ExprError, highlight_tokens, KEYWORDS, LAZY_FUNCTIONS, parse, POKER_HANDS, PURE_FUNCTIONS,
  RANK_NAMES, sample_value, SEALS, shown, SUITS, type Expr, type Scope,
} from '@/shared/lib/mod';
import { useI18n } from '@/shared/i18n';

export type LiteralKind = 'suit' | 'rank' | 'enhancement' | 'seal' | 'edition' | 'hand' | 'joker' | 'voucher' | 'blind' | 'key' | 'set' | 'tag';

export interface Completion { label: string; insert: string; kind: string; detail?: string; caret?: number }

/** a string's value offered as a completion (a key with its name) */
export interface LiteralOption { value: string; label?: string }

const NUMBER = /^-?\d+(\.\d+)?$/;

/** a typed source as the package keeps it: a plain number stays a number */
export function expr_value(text: string): Expr {
  return NUMBER.test(text.trim()) ? Number(text.trim()) : text;
}

const FN_LITERALS: Record<string, (LiteralKind | null)[]> = {
  is_suit: [null, 'suit'], is_rank: [null, 'rank'], count_suit: [null, 'suit'], count_rank: [null, 'rank'],
  count_enhancement: [null, 'enhancement'], count_seal: [null, 'seal'], count_edition: [null, 'edition'], count_key: [null, 'key'],
  hand_level: ['hand'], times_played: ['hand'], has_hand: ['hand'], has_joker: ['joker'], has_voucher: ['voucher'],
};
const FIELD_LITERALS: Record<string, LiteralKind> = {
  suit: 'suit', rank_name: 'rank', enhancement: 'enhancement', seal: 'seal', edition: 'edition', name: 'hand', key: 'key', set: 'set',
};
const BUILTIN_LITERALS: Partial<Record<LiteralKind, string[]>> = {
  suit: [...SUITS], rank: RANK_NAMES, enhancement: [...ENHANCEMENTS], seal: [...SEALS], edition: [...EDITIONS], hand: [...POKER_HANDS],
  set: ['Default', 'Enhanced', 'Joker', 'Tarot', 'Planet', 'Spectral', 'Voucher'],
};

type Tok = ReturnType<typeof highlight_tokens>[number];

/** what the caret is in: a name being typed, a field after a dot, or a string literal */
function context_at(src: string, caret: number, toks: Tok[]) {
  const idx = toks.findIndex((t) => t.start < caret && caret <= t.start + t.text.length);
  const tok = idx >= 0 ? toks[idx] : null;
  const prev_real = (i: number) => { for (let k = i - 1; k >= 0; k--) if (toks[k].kind !== 'ws') return { t: toks[k], i: k }; return null; };
  if (tok && tok.kind === 'str') {
    const prefix = src.slice(tok.start + 1, caret);
    const quote = tok.text[0];
    const closed = tok.text.length > 1 && tok.text.endsWith(quote) && caret < tok.start + tok.text.length;
    const before = prev_real(idx);
    let lit: LiteralKind | null = null;
    if (before && (before.t.text === '(' || before.t.text === ',')) {
      // which argument of which call
      let depth = 0;
      let arg = 0;
      for (let k = idx - 1; k >= 0; k--) {
        const t = toks[k];
        if (t.text === ')') depth++;
        else if (t.text === '(') {
          if (depth === 0) {
            const fn = prev_real(k);
            if (fn && fn.t.kind === 'name') lit = FN_LITERALS[fn.t.text]?.[arg] ?? null;
            break;
          }
          depth--;
        } else if (t.text === ',' && depth === 0) arg++;
      }
    } else if (before && (before.t.text === '==' || before.t.text === '!=')) {
      const field = prev_real(before.i);
      const dot = field ? prev_real(field.i) : null;
      if (field && field.t.kind === 'name' && dot?.t.text === '.') lit = FIELD_LITERALS[field.t.text] ?? null;
      if (lit === 'key') {
        const root = dot ? prev_real(dot.i) : null;
        if (root?.t.text === 'blind') lit = 'blind';
      }
    }
    return { mode: 'literal' as const, lit, prefix, start: tok.start + 1, end: closed ? tok.start + tok.text.length - 1 : caret, quote, closed };
  }
  if (tok && (tok.kind === 'name' || tok.kind === 'kw')) {
    const prefix = src.slice(tok.start, caret);
    const dot = prev_real(idx);
    if (dot && dot.t.text === '.') {
      const root = prev_real(dot.i);
      return { mode: 'field' as const, root: root?.t.kind === 'name' ? root.t.text : null, prefix, start: tok.start, end: tok.start + tok.text.length };
    }
    return { mode: 'name' as const, prefix, start: tok.start, end: tok.start + tok.text.length };
  }
  if (tok && tok.text === '.' && caret === tok.start + 1) {
    const root = prev_real(idx);
    return { mode: 'field' as const, root: root?.t.kind === 'name' ? root.t.text : null, prefix: '', start: caret, end: caret };
  }
  return null;
}

export function ExpressionInput({ value, onChange, scope, values, literals, id, describedby, label, placeholder, multiline = true, show_value = true, condition }: {
  value: Expr | undefined;
  onChange: (v: Expr) => void;
  scope: Scope;
  /** the item's values (self.<name>) for the sample */
  values?: Record<string, unknown>;
  /** the values a string can take that the game or the mod knows (keys) */
  literals?: (kind: LiteralKind) => LiteralOption[];
  id?: string;
  describedby?: string;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  show_value?: boolean;
  /** a condition: its value is shown as true/false */
  condition?: boolean;
}) {
  const { t } = useI18n();
  const text = value === undefined ? '' : String(value);
  const area = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const toks = useMemo(() => highlight_tokens(text), [text]);
  const error_at = useMemo(() => {
    if (!text.trim()) return null;
    try { parse(text); return null; } catch (e) { return e instanceof ExprError ? e.at : null; }
  }, [text]);

  const completions = useMemo((): { items: Completion[]; start: number; end: number; closing?: string } | null => {
    if (caret === null) return null;
    const ctx = context_at(text, caret, toks);
    if (!ctx) return null;
    const pre = ctx.prefix.toLowerCase();
    const items: Completion[] = [];
    if (ctx.mode === 'name') {
      for (const [root, fields] of scope.roots) {
        const needs_field = fields !== null && fields.size > 0 && !scope.refs.has(root);
        items.push({ label: root, insert: needs_field || root === 'self' ? `${root}.` : root, kind: 'root', detail: t.expr.roots[root] });
      }
      const fns = new Map<string, [number, number]>([...Object.entries(PURE_FUNCTIONS).map(([k, v]) => [k, [v[0], v[1]]] as [string, [number, number]]),
        ...Object.entries(LAZY_FUNCTIONS), ...scope.functions]);
      for (const [fn] of fns) {
        if (scope.impure.has(fn) && !scope.allow_impure) continue;
        items.push({ label: fn, insert: `${fn}()`, caret: fn.length + 1, kind: 'function', detail: t.expr.functions[fn] ? `${t.expr.functions[fn].sig} — ${t.expr.functions[fn].help}` : undefined });
      }
      for (const k of KEYWORDS) items.push({ label: k, insert: k, kind: 'keyword', detail: t.expr.keywords[k] });
    } else if (ctx.mode === 'field' && ctx.root) {
      const fields = scope.roots.get(ctx.root);
      if (fields) {
        for (const f of fields) {
          const detail = ctx.root === 'self' ? (values && f in values ? `= ${shown(values[f])}` : undefined)
            : t.expr.fields[ctx.root === 'other' ? 'card' : ctx.root]?.[f];
          items.push({ label: f, insert: f, kind: ctx.root === 'self' ? 'config' : 'field', detail });
        }
        if (ctx.root === 'other' || ctx.root === 'card') for (const f of CARD_FIELDS) if (!fields.has(f)) items.push({ label: f, insert: f, kind: 'field' });
      }
    } else if (ctx.mode === 'literal' && ctx.lit) {
      const opts: LiteralOption[] = [
        ...(BUILTIN_LITERALS[ctx.lit] ?? []).map((v) => ({ value: v })),
        ...(literals?.(ctx.lit) ?? []),
      ];
      const seen = new Set<string>();
      for (const o of opts) {
        if (seen.has(o.value)) continue;
        seen.add(o.value);
        items.push({ label: o.value, insert: o.value, kind: 'value', detail: o.label });
      }
    }
    const filtered = items.filter((c) => c.label.toLowerCase().startsWith(pre) && c.label !== ctx.prefix)
      .concat(items.filter((c) => !c.label.toLowerCase().startsWith(pre) && pre.length > 1 && c.label.toLowerCase().includes(pre)))
      .slice(0, 40);
    if (!filtered.length) return null;
    const closing = ctx.mode === 'literal' && !ctx.closed ? ctx.quote : undefined;
    return { items: filtered, start: ctx.start, end: ctx.end, closing };
  }, [caret, text, toks, scope, values, literals, t]);

  const sig = completions ? `${completions.start}:${text}` : null;
  const open = completions !== null && sig !== dismissed;

  const accept = (c: Completion) => {
    if (!completions) return;
    const insert = c.insert + (completions.closing ?? '');
    const next = text.slice(0, completions.start) + insert + text.slice(completions.end);
    const pos = completions.start + (c.caret ?? insert.length);
    onChange(expr_value(next));
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });
    setActive(0);
  };

  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && completions) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % completions.items.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + completions.items.length) % completions.items.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(completions.items[Math.min(active, completions.items.length - 1)]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(sig); return; }
    }
    if (e.key === 'Enter') e.preventDefault(); // (an expression is one line)
    if (e.key === ' ' && e.ctrlKey) { e.preventDefault(); setDismissed(null); }
  };

  const sample = useMemo(() => {
    if (!show_value || !text.trim() || error_at !== null) return null;
    try { parse(text); } catch { return null; }
    return sample_value(value, values ?? {});
  }, [show_value, text, value, values, error_at]);

  const root_known = (name: string) => scope.roots.has(name);
  const fn_known = (name: string) => name in PURE_FUNCTIONS || name in LAZY_FUNCTIONS || scope.functions.has(name);

  return (
    <div className={['expr', multiline ? '' : 'expr--line', error_at !== null ? 'expr--bad' : ''].filter(Boolean).join(' ')}>
      <div className="expr__box">
        <pre className="expr__hl" aria-hidden>
          {toks.map((tk, i) => {
            const next = toks.slice(i + 1).find((x) => x.kind !== 'ws');
            const prev = toks.slice(0, i).reverse().find((x) => x.kind !== 'ws');
            let cls = `tk-${tk.kind}`;
            if (tk.kind === 'name') {
              if (next?.text === '(') cls = fn_known(tk.text) ? 'tk-fn' : 'tk-unknown';
              else if (prev?.text === '.') cls = 'tk-field';
              else cls = root_known(tk.text) ? `tk-root tk-root--${tk.text}` : 'tk-unknown';
            }
            const bad = error_at !== null && tk.start <= error_at && error_at < tk.start + Math.max(1, tk.text.length);
            return <span key={i} className={bad ? `${cls} tk-error` : cls}>{tk.text}</span>;
          })}
          {error_at !== null && error_at >= text.length ? <span className="tk-error tk-eol"> </span> : null}
          {'\n'}
        </pre>
        <textarea ref={area} id={id} className="expr__input" value={text} rows={1} spellCheck={false} autoComplete="off"
          autoCapitalize="off" aria-describedby={describedby} aria-label={label} placeholder={placeholder ?? t.expr.placeholder}
          aria-autocomplete="list" aria-expanded={open}
          onChange={(e) => { onChange(expr_value(e.target.value)); setCaret(e.target.selectionStart); setActive(0); setDismissed(null); }}
          onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
          onFocus={(e) => setCaret(e.target.selectionStart)}
          onBlur={() => setTimeout(() => setCaret(null), 150)}
          onKeyDown={keys} />
        {sample ? (
          <span className={`expr__value ${sample.random ? 'is-random' : ''}`} title={`${t.expr.on_sample} — ${t.expr.sample_note}`}>
            {sample.random ? t.expr.random : condition ? (sample.value !== null && sample.value !== false ? 'true' : 'false') : sample.value === null ? t.expr.nil : `= ${shown(sample.value)}`}
          </span>
        ) : null}
      </div>
      {open && completions ? (
        <ul className="expr__complete" role="listbox">
          {completions.items.map((c, i) => (
            <li key={`${c.kind}:${c.label}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); accept(c); }} onMouseEnter={() => setActive(i)}>
              <span className={`expr__kind expr__kind--${c.kind}`}>{t.expr.kinds[c.kind] ?? c.kind}</span>
              <span className="expr__label">{c.label}</span>
              {c.detail ? <span className="expr__detail">{c.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
