// What opens over the page: dialogs (the browser's <dialog>, so focus and
// Escape behave), a confirmation asked with `await confirm(...)`, popovers and
// menus anchored to a button, and toasts.
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from './controls';
import { Icon, type IconName } from './icons';

export function Modal({ open, onClose, title, children, footer, size = 'md', className }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={['modal', `modal--${size}`, className ?? ''].filter(Boolean).join(' ')}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open ? (
        <div className="modal__box">
          <header className="modal__head">
            <h2 className="modal__title">{title}</h2>
            <IconButton icon="x" label="×" onClick={onClose} />
          </header>
          <div className="modal__body">{children}</div>
          {footer ? <footer className="modal__foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

// ------------------------------------------------------------------ confirm
interface ConfirmAsk { text: ReactNode; ok: string; cancel: string; danger: boolean; resolve: (v: boolean) => void }
const ConfirmContext = createContext<((text: ReactNode, opts?: { ok?: string; danger?: boolean }) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children, ok, cancel, title }: { children: ReactNode; ok: string; cancel: string; title: string }) {
  const [ask, setAsk] = useState<ConfirmAsk | null>(null);
  const confirm = useCallback((text: ReactNode, opts?: { ok?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setAsk({ text, ok: opts?.ok ?? ok, cancel, danger: opts?.danger ?? true, resolve })), [ok, cancel]);
  const close = (v: boolean) => { ask?.resolve(v); setAsk(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={ask !== null} onClose={() => close(false)} title={title} size="sm"
        footer={<>
          <Button tone="ghost" onClick={() => close(false)}>{ask?.cancel}</Button>
          <Button tone={ask?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{ask?.ok}</Button>
        </>}>
        <div className="confirm-text">{ask?.text}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const c = useContext(ConfirmContext);
  if (!c) throw new Error('useConfirm outside ConfirmProvider');
  return c;
}

// ------------------------------------------------------------------ popover
/** a panel under (or over) an anchor, closed by a click outside or Escape */
export function Popover({ anchor, open, onClose, children, className, align = 'start', width }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: ReactNode; className?: string;
  align?: 'start' | 'end'; width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = ref.current?.getBoundingClientRect();
      if (!a) return;
      const h = p?.height ?? 300;
      const w = p?.width ?? width ?? 280;
      const up = a.bottom + h + 8 > window.innerHeight && a.top - h - 8 > 0;
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos({ left, top: up ? a.top - h - 6 : a.bottom + 6, up });
    };
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchor, align, width]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchor.current?.focus(); } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); };
  }, [open, onClose, anchor]);
  if (!open) return null;
  return createPortal(
    <div ref={ref} className={['popover', className ?? ''].filter(Boolean).join(' ')}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}>
      {children}
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: ReactNode;
  icon?: IconName;
  hint?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** a heading between items */
  group?: string;
  swatch?: string;
}

/** a button that opens a list of actions */
export function Menu({ trigger, items, align = 'start', width = 260, label }: {
  trigger: (props: { ref: RefObject<HTMLButtonElement | null>; onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  items: MenuItem[]; align?: 'start' | 'end'; width?: number; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  }, [open]);
  const keys = (e: React.KeyboardEvent) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length]?.focus(); }
  };
  return (
    <>
      {trigger({ ref, onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align={align} width={width} className="menu">
        <div ref={list} role="menu" aria-label={label} onKeyDown={keys}>
          {items.map((it, i) =>
            it.group !== undefined && !it.onSelect ? (
              <p key={i} className="menu__group">{it.group}</p>
            ) : (
              <button key={i} type="button" role="menuitem" disabled={it.disabled} className={['menu__item', it.danger ? 'is-danger' : ''].join(' ')}
                onClick={() => { setOpen(false); it.onSelect?.(); }}>
                {it.swatch ? <span className="menu__swatch" style={{ background: it.swatch }} /> : it.icon ? <Icon name={it.icon} size={16} /> : <span className="menu__noicon" />}
                <span className="menu__text">
                  <span className="menu__label">{it.label}</span>
                  {it.hint ? <span className="menu__hint">{it.hint}</span> : null}
                </span>
              </button>
            ),
          )}
        </div>
      </Popover>
    </>
  );
}

// ------------------------------------------------------------------ toasts
interface Toast { id: number; text: ReactNode; tone: 'info' | 'ok' | 'error' }
const ToastContext = createContext<((text: ReactNode, tone?: Toast['tone']) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const toast = useCallback((text: ReactNode, tone: Toast['tone'] = 'info') => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  const value = useMemo(() => toast, [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'ok' ? 'check' : 'info'} size={16} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const t = useContext(ToastContext);
  if (!t) throw new Error('useToast outside ToastProvider');
  return t;
}
