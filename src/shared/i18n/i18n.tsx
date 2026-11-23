// The editor in the player's language: English and Russian (the game has
// more; its other languages fall back to the browser's, then English). The
// choice is the site's: the game's settings keep it (language.ts), so the
// portal, the casino, the game and the editor speak the same one.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ProblemError } from '@/shared/api';
import { browser_languages, on_language_change, store_language, stored_language } from './language';
import { en, type Messages } from './messages/en';
import { ru } from './messages/ru';

export type Lang = 'en' | 'ru';

export interface Language {
  code: Lang;
  /** its own name */
  name: string;
  /** the game's key for it (its settings, a mod's `loc`) */
  game: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', game: 'en-us' },
  { code: 'ru', name: 'Русский', game: 'ru' },
];

const MESSAGES: Record<Lang, Messages> = { en, ru };

function ours(key: string | null): Lang | null {
  if (!key) return null;
  const k = key.toLowerCase();
  const found = LANGUAGES.find((l) => l.game === k || l.code === k || l.code === k.split(/[-_]/)[0]);
  return found?.code ?? null;
}

function initial(): Lang {
  const chosen = ours(stored_language());
  if (chosen) return chosen;
  for (const tag of browser_languages()) {
    const l = ours(tag);
    if (l) return l;
  }
  return 'en';
}

export interface Formats {
  number(x: number): string;
  /** 1.2 kB, 340 kB */
  bytes(n: number): string;
  /** 5 minutes ago */
  ago(at: number | string, now?: number): string;
  datetime(at: number | string): string;
}

function formats(locale: string, kb: string): Formats {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const datetime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const ms = (at: number | string) => (typeof at === 'number' ? at : Date.parse(at));
  return {
    number: (x) => number.format(x),
    bytes: (n) => (n < 1000 ? `${number.format(n)} B` : n < 1_000_000 ? `${one.format(n / 1000)} ${kb}` : `${one.format(n / 1_000_000)} MB`),
    ago(at, now = Date.now()) {
      const s = (ms(at) - now) / 1000;
      const a = Math.abs(s);
      if (a < 45) return relative.format(0, 'second');
      if (a < 3600) return relative.format(Math.round(s / 60), 'minute');
      if (a < 86400) return relative.format(Math.round(s / 3600), 'hour');
      if (a < 86400 * 7) return relative.format(Math.round(s / 86400), 'day');
      return date.format(new Date(ms(at)));
    },
    datetime: (at) => datetime.format(new Date(ms(at))),
  };
}

export interface I18n {
  lang: Lang;
  /** the game's language key for the editor's language (en-us, ru): the game's texts are loaded in it */
  game_lang: string;
  t: Messages;
  f: Formats;
  set_lang(lang: Lang): void;
  /** a service's error, for the player (its stable code, in their language) */
  describe(error: unknown): string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initial);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => on_language_change(() => setLang(initial())), []);

  const set_lang = useCallback((l: Lang) => {
    store_language(LANGUAGES.find((x) => x.code === l)?.game ?? l);
    setLang(l);
  }, []);

  const value = useMemo<I18n>(() => {
    const t = MESSAGES[lang];
    return {
      lang,
      game_lang: LANGUAGES.find((l) => l.code === lang)?.game ?? 'en-us',
      t,
      f: formats(lang, t.common.kb),
      set_lang,
      describe(error) {
        if (error instanceof ProblemError) {
          const known = (t.errors.codes as Record<string, string>)[error.code];
          if (known) return known;
          return error.message ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + '.' : t.errors.unknown;
        }
        if (error instanceof TypeError) return t.errors.network;
        if (error instanceof Error && error.message) return error.message;
        return t.errors.unknown;
      },
    };
  }, [lang, set_lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
