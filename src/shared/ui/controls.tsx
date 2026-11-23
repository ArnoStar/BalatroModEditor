// The editor's controls: buttons, fields and inputs. Every input has a label
// (visible, or aria-label); focus is always visible (styles: controls.css).
import {
  forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from 'react-router';
import { Icon, type IconName } from './icons';

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold';
type Size = 'sm' | 'md' | 'lg';

const btn = (tone: Tone, size: Size, wide?: boolean, extra?: string) =>
  ['btn', `btn--${tone}`, `btn--${size}`, wide ? 'btn--wide' : '', extra ?? ''].filter(Boolean).join(' ');

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  icon?: IconName;
  wide?: boolean;
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = 'secondary', size = 'md', icon, wide, busy, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={btn(tone, size, wide, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner spinner--sm" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
});

export function LinkButton({ tone = 'secondary', size = 'md', icon, wide, className, children, ...rest }: LinkProps & { tone?: Tone; size?: Size; icon?: IconName; wide?: boolean }) {
  return (
    <Link className={btn(tone, size, wide, className)} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children ? <span>{children as ReactNode}</span> : null}
    </Link>
  );
}

export function AnchorButton({ tone = 'secondary', size = 'md', icon, wide, className, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { tone?: Tone; size?: Size; icon?: IconName; wide?: boolean }) {
  return (
    <a className={btn(tone, size, wide, className)} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children ? <span>{children}</span> : null}
    </a>
  );
}

/** a button that is only an icon: `label` is what it says (shown on hover, read by screen readers) */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'children'> & { label: string; icon: IconName; active?: boolean }>(
  function IconButton({ label, icon, tone = 'ghost', size = 'md', active, className, type = 'button', ...rest }, ref) {
    return (
      <button ref={ref} type={type} aria-label={label} data-tip={label} aria-pressed={active}
        className={['icon-btn', `icon-btn--${tone}`, `icon-btn--${size}`, active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')} {...rest}>
        <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 17} />
      </button>
    );
  },
);

// ------------------------------------------------------------------ fields
export interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  /** problems to show under the field (already in the player's words) */
  errors?: { text: string; level: 'error' | 'warning' }[];
  children: (id: string, describedby: string | undefined) => ReactNode;
  inline?: boolean;
  aside?: ReactNode;
  className?: string;
  /** the place of the package it edits (a problem's link scrolls here) */
  path?: string;
}

/** a labelled control: its help and its problems under it */
export function Field({ label, help, errors, children, inline, aside, className, path }: FieldProps) {
  const id = useId();
  const help_id = help || errors?.length ? `${id}-help` : undefined;
  const bad = errors?.some((e) => e.level === 'error');
  return (
    <div data-path={path} className={['field', inline ? 'field--inline' : '', bad ? 'field--error' : errors?.length ? 'field--warning' : '', className ?? ''].filter(Boolean).join(' ')}>
      <div className="field__head">
        <label className="field__label" htmlFor={id}>{label}</label>
        {aside ? <span className="field__aside">{aside}</span> : null}
      </div>
      <div className="field__control">{children(id, help_id)}</div>
      {help || errors?.length ? (
        <div className="field__notes" id={help_id}>
          {errors?.map((e, i) => (
            <p key={i} className={`field__problem field__problem--${e.level}`}>
              <Icon name={e.level === 'error' ? 'alert' : 'info'} size={14} />
              {e.text}
            </p>
          ))}
          {help ? <p className="field__help">{help}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** a text input that keeps what is typed while it has focus (the stored value may be normalised) */
export const TextInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string; onChange: (v: string) => void; mono?: boolean;
}>(function TextInput({ value, onChange, mono, className, ...rest }, ref) {
  return (
    <input ref={ref} className={['input', mono ? 'input--mono' : '', className ?? ''].filter(Boolean).join(' ')} value={value}
      onChange={(e) => onChange(e.target.value)} spellCheck={mono ? false : undefined} autoComplete="off" {...rest} />
  );
});

export function TextArea({ value, onChange, className, rows = 3, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string; onChange: (v: string) => void;
}) {
  return <textarea className={['input', 'input--area', className ?? ''].filter(Boolean).join(' ')} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

/** a number: typed freely, sent when it is a number (empty sends null); arrows step it */
export function NumberInput({ value, onChange, min, max, step = 1, id, placeholder, className, describedby, label, integer }: {
  value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; id?: string;
  placeholder?: string; className?: string; describedby?: string; label?: string; integer?: boolean;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null || value === undefined ? '' : String(value));
  }, [value]);
  const commit = (s: string) => {
    setText(s);
    const t = s.trim().replace(',', '.');
    if (t === '') return onChange(null);
    const n = Number(t);
    if (Number.isFinite(n)) onChange(integer ? Math.round(n) : n);
  };
  const nudge = (d: number) => {
    const base = typeof value === 'number' ? value : 0;
    let n = Math.round((base + d) * 1e6) / 1e6;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    setText(String(n));
    onChange(n);
  };
  return (
    <span className={['number', className ?? ''].filter(Boolean).join(' ')}>
      <input id={id} className="input input--number" inputMode="decimal" value={text} placeholder={placeholder}
        aria-describedby={describedby} aria-label={label}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(value === null || value === undefined ? '' : String(value)); }}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); nudge(e.shiftKey ? step * 10 : step); }
          if (e.key === 'ArrowDown') { e.preventDefault(); nudge(e.shiftKey ? -step * 10 : -step); }
        }} />
      <span className="number__steps">
        <button type="button" tabIndex={-1} aria-hidden onClick={() => nudge(step)}><Icon name="chevron-up" size={12} /></button>
        <button type="button" tabIndex={-1} aria-hidden onClick={() => nudge(-step)}><Icon name="chevron-down" size={12} /></button>
      </span>
    </span>
  );
}

export interface Option<T extends string> { value: T; label: string; hint?: string; disabled?: boolean }

export function Select<T extends string>({ value, onChange, options, id, describedby, label, className, placeholder }: {
  value: T | '' | undefined; onChange: (v: T) => void; options: Option<T>[] | { group: string; options: Option<T>[] }[]; id?: string;
  describedby?: string; label?: string; className?: string; placeholder?: string;
}) {
  const grouped = options.length > 0 && 'group' in options[0];
  return (
    <span className={['select', className ?? ''].filter(Boolean).join(' ')}>
      <select id={id} value={value ?? ''} aria-describedby={describedby} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
        {placeholder !== undefined ? <option value="" disabled>{placeholder}</option> : null}
        {grouped
          ? (options as { group: string; options: Option<T>[] }[]).map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
            </optgroup>
          ))
          : (options as Option<T>[]).map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
      <Icon name="chevron-down" size={14} />
    </span>
  );
}

export function Toggle({ checked, onChange, label, id, describedby, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; id?: string; describedby?: string; disabled?: boolean;
}) {
  return (
    <label className={['toggle', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} aria-describedby={describedby}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden><span className="toggle__thumb" /></span>
      {label ? <span className="toggle__label">{label}</span> : null}
    </label>
  );
}

/** a row of choices, one of them on */
export function Segmented<T extends string | number>({ value, onChange, options, label, className, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string; colour?: string; disabled?: boolean }[];
  label: string; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div className={['segmented', `segmented--${size}`, className ?? ''].filter(Boolean).join(' ')} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title} disabled={o.disabled}
          className={o.value === value ? 'is-on' : ''} style={o.colour ? ({ '--seg': o.colour } as React.CSSProperties) : undefined}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return <span className={`spinner spinner--${size}`} role={label ? 'status' : undefined} aria-label={label} />;
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'error' | 'warning' | 'ok' | 'info' | 'gold'; title?: string }) {
  return <span className={`badge badge--${tone}`} title={title}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Empty({ icon, title, children, actions }: { icon?: IconName; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      {icon ? <span className="empty__icon"><Icon name={icon} size={26} /></span> : null}
      <p className="empty__title">{title}</p>
      {children ? <div className="empty__text">{children}</div> : null}
      {actions ? <div className="empty__actions">{actions}</div> : null}
    </div>
  );
}

/** a titled block of a form */
export function Section({ title, help, actions, children, id, tone, className }: {
  title: ReactNode; help?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; tone?: string; className?: string;
}) {
  return (
    <section className={['section', className ?? ''].filter(Boolean).join(' ')} id={id} style={tone ? ({ '--tone': tone } as React.CSSProperties) : undefined}>
      <header className="section__head">
        <div>
          <h2 className="section__title">{title}</h2>
          {help ? <p className="section__help">{help}</p> : null}
        </div>
        {actions ? <div className="section__actions">{actions}</div> : null}
      </header>
      <div className="section__body">{children}</div>
    </section>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warning' | 'error' | 'ok'; children: ReactNode; icon?: IconName }) {
  const def: Record<string, IconName> = { info: 'info', warning: 'alert', error: 'alert', ok: 'check' };
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon ?? def[tone]} size={16} />
      <div>{children}</div>
    </div>
  );
}

/** how many errors (and warnings) something has: nothing when it has none */
export function ProblemsBadge({ errors = 0, warnings = 0 }: { errors?: number; warnings?: number }) {
  if (!errors && !warnings) return null;
  return (
    <span className={`problems-badge ${errors ? 'is-error' : 'is-warning'}`}>
      <Icon name={errors ? 'alert' : 'info'} size={13} />
      {errors || warnings}
    </span>
  );
}
