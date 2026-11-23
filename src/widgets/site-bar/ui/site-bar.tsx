import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Account } from '@/entities/session';
import { GAME_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { Brand, Icon, LanguageSelect } from '@/shared/ui';

/** the bar on the pages outside a mod: the editor's home and its reference */
export function SiteBar({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="sitebar">
      <Brand />
      <nav className="sitebar__nav" aria-label={t.app.nav_label}>
        <NavLink to="/" end className="sitebar__link"><Icon name="folder" size={16} />{t.app.your_mods}</NavLink>
        <NavLink to="/reference" className="sitebar__link"><Icon name="book" size={16} />{t.app.reference}</NavLink>
        <a href={`${GAME_URL}/`} className="sitebar__link"><Icon name="play" size={16} />{t.app.play}</a>
        <a href="/" className="sitebar__link"><Icon name="home" size={16} />{t.app.portal}</a>
      </nav>
      <div className="sitebar__mid">{children}</div>
      <div className="sitebar__end">
        <LanguageSelect />
        <Account />
      </div>
    </header>
  );
}
