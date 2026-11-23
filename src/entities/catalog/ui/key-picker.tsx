// Choosing one of the game's cards (or one of the mod's own): a button with
// the card's picture and name, opening a searchable grid.
import { useMemo, useRef, useState } from 'react';
import { useI18n } from '@/shared/i18n';
import { BlindChip, CardArt, Icon, Popover, Sprite } from '@/shared/ui';
import { useCatalog, type PickItem, type PickKind } from '../model/catalog';

export function ItemPicture({ item, scale = 0.6 }: { item: Pick<PickItem, 'picture' | 'chip' | 'tag'>; scale?: number }) {
  if (item.chip) return <BlindChip y={item.chip.y} scale={scale * 1.4} colour={item.chip.colour} />;
  if (item.tag) return <Sprite atlas="tags" x={item.tag.x} y={item.tag.y} scale={scale * 1.4} />;
  return <CardArt picture={item.picture ?? null} scale={scale} />;
}

/** every card of these kinds, the mod's own (`extra`) first */
export function use_pick_items(kinds: PickKind[], extra: PickItem[] = []): PickItem[] {
  const { items } = useCatalog();
  return useMemo(() => [...extra, ...kinds.flatMap((k) => items(k))], [items, kinds, extra]);
}

export function KeyPicker({ value, onChange, kinds, extra, label, id, placeholder, allow_none, none_label, describedby, compact }: {
  value: string | undefined;
  onChange: (key: string | undefined) => void;
  kinds: PickKind[];
  /** the mod's own cards of these kinds */
  extra?: PickItem[];
  label: string;
  id?: string;
  placeholder?: string;
  allow_none?: boolean;
  none_label?: string;
  describedby?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { name, status } = useCatalog();
  const all = use_pick_items(kinds, extra);
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = all.find((x) => x.key === value);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? all.filter((x) => x.key.toLowerCase().includes(s) || x.name.toLowerCase().includes(s)) : all;
  }, [all, q]);
  const typed = q.trim();
  return (
    <>
      <button ref={ref} id={id} type="button" className={['picker', compact ? 'picker--compact' : '', value ? '' : 'is-empty'].filter(Boolean).join(' ')}
        aria-haspopup="dialog" aria-expanded={open} aria-label={label} aria-describedby={describedby} onClick={() => setOpen((o) => !o)}>
        {current ? <ItemPicture item={current} scale={compact ? 0.32 : 0.42} /> : null}
        <span className="picker__text">
          <span className="picker__name">{value ? (current?.name ?? name(value)) : (none_label ?? placeholder ?? t.common.none)}</span>
          {value ? <code className="picker__key">{value}</code> : null}
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      <Popover anchor={ref} open={open} onClose={() => { setOpen(false); setQ(''); }} width={460} className="picker-pop">
        <div className="picker-pop__search">
          <Icon name="search" size={16} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.common.search} aria-label={t.common.search}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) { onChange(shown[0].key); setOpen(false); setQ(''); }
            }} />
        </div>
        <div className="picker-pop__grid" role="listbox" aria-label={label}>
          {allow_none ? (
            <button type="button" role="option" aria-selected={!value} className={!value ? 'is-on' : ''} onClick={() => { onChange(undefined); setOpen(false); }}>
              <span className="picker-pop__none"><Icon name="x" /></span>
              <span className="picker-pop__name">{none_label ?? t.common.none}</span>
            </button>
          ) : null}
          {shown.slice(0, 400).map((x) => (
            <button key={x.key} type="button" role="option" aria-selected={x.key === value} className={x.key === value ? 'is-on' : ''}
              title={`${x.name} — ${x.key}`} onClick={() => { onChange(x.key); setOpen(false); setQ(''); }}>
              <ItemPicture item={x} scale={0.5} />
              <span className="picker-pop__name">{x.name}</span>
            </button>
          ))}
          {!shown.length && typed && /^[a-z]+_[a-z0-9_]+$/.test(typed) ? (
            <button type="button" className="picker-pop__typed" onClick={() => { onChange(typed); setOpen(false); setQ(''); }}>
              <code>{typed}</code>
            </button>
          ) : null}
        </div>
        {status === 'offline' ? <p className="picker-pop__note">{t.reference.keys_offline}</p> : null}
      </Popover>
    </>
  );
}
