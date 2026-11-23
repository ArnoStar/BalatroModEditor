import { useEffect, useRef } from 'react';

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** `mod+z`, `mod+shift+z`, `escape`...: mod is Cmd on a Mac, Ctrl elsewhere */
export function use_hotkeys(keys: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      const combo = [mod ? 'mod' : '', e.shiftKey ? 'shift' : '', e.altKey ? 'alt' : '', e.key.toLowerCase()].filter(Boolean).join('+');
      const f = ref.current[combo];
      if (f) f(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [enabled]);
}

/** how a shortcut is written for this keyboard: Ctrl+Z, ⌘Z */
export const shortcut = (combo: string) =>
  combo.split('+').map((k) => (k === 'mod' ? (IS_MAC ? '⌘' : 'Ctrl') : k === 'shift' ? (IS_MAC ? '⇧' : 'Shift') : k.toUpperCase())).join(IS_MAC ? '' : '+');
