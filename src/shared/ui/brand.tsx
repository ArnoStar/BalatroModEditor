// The editor's mark and the site's language choice (the portal's, the
// casino's and the game's: one setting).
import { NavLink } from 'react-router';
import { LANGUAGES, useI18n, type Lang } from '@/shared/i18n';
import { Icon } from './icons';

export function Brand() {
  const { t } = useI18n();
  return (
    <NavLink to="/" className="brand" aria-label={t.app.your_mods}>
      <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="bm-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#62a8ff" /><stop offset="1" stopColor="#5b45ff" /></linearGradient>
          <linearGradient id="bm-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8aa0" /><stop offset="1" stopColor="#e0285a" /></linearGradient>
        </defs>
        <rect x="4.5" y="7.5" width="17" height="24" rx="4" fill="url(#bm-a)" transform="rotate(-14 13 19.5)" />
        <rect x="18.5" y="8" width="17" height="24" rx="4" fill="url(#bm-b)" transform="rotate(13 27 20)" />
        <path d="M27 12l-9.5 9.5M24.5 23.5l4-4M15 26l1.8-1.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="brand__text">
        <span className="brand__top">{t.app.brand_top}</span>
        <span className="brand__word">{t.app.brand}</span>
      </span>
    </NavLink>
  );
}

export function LanguageSelect() {
  const { lang, set_lang, t } = useI18n();
  return (
    <label className="lang" title={t.app.language}>
      <Icon name="globe" size={16} />
      <span className="lang__code" aria-hidden>{lang.toUpperCase()}</span>
      <select value={lang} aria-label={t.app.language} onChange={(e) => set_lang(e.target.value as Lang)}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
