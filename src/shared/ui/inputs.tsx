// Smaller inputs: a list of words (tags), a colour, highlighted JSON.
import { Fragment, useState, type KeyboardEvent } from 'react';
import { IconButton } from './controls';

export function TagsInput({ value, onChange, placeholder, id, max = 8, describedby, normalize }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string; max?: number; describedby?: string;
  normalize?: (s: string) => string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = (normalize ? normalize(draft) : draft).trim();
    if (!v || value.includes(v) || value.length >= max) { setDraft(''); return; }
    onChange([...value, v]);
    setDraft('');
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="tags-input">
      {value.map((tag) => (
        <span key={tag} className="chip">
          {tag}
          <IconButton size="sm" icon="x" label={`− ${tag}`} onClick={() => onChange(value.filter((x) => x !== tag))} />
        </span>
      ))}
      {value.length < max ? (
        <input id={id} className="tags-input__draft" value={draft} placeholder={placeholder} aria-describedby={describedby}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={keys} onBlur={add} />
      ) : null}
    </div>
  );
}

export function ColourInput({ value, onChange, id, describedby, fallback = '#b44430' }: {
  value: string | undefined; onChange: (v: string | undefined) => void; id?: string; describedby?: string; fallback?: string;
}) {
  return (
    <span className="colour-input">
      <input type="color" id={id} aria-describedby={describedby} value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback}
        onChange={(e) => onChange(e.target.value)} />
      <input className="input input--mono colour-input__text" value={value ?? ''} placeholder={fallback} maxLength={7}
        onChange={(e) => onChange(e.target.value || undefined)} aria-label="#rrggbb" />
    </span>
  );
}

/** JSON, highlighted (keys, strings, numbers, words) */
export function JsonView({ text, className }: { text: string; className?: string }) {
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(<Fragment key={n++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) {
      const long = m[1].length > 300 ? m[1].slice(0, 120) + '…' + m[1].slice(-12) : m[1];
      out.push(<span key={n++} className={m[2] ? 'js-key' : 'js-str'}>{long}</span>);
      if (m[2]) out.push(<Fragment key={n++}>{m[2]}</Fragment>);
    } else if (m[3]) out.push(<span key={n++} className="js-num">{m[3]}</span>);
    else out.push(<span key={n++} className="js-word">{m[4]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={n++}>{text.slice(last)}</Fragment>);
  return <pre className={['json', className ?? ''].filter(Boolean).join(' ')}>{out}</pre>;
}
