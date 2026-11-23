import { SiteBar } from '@/widgets/site-bar';
import { useI18n } from '@/shared/i18n';
import { Empty, LinkButton } from '@/shared/ui';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="home">
      <SiteBar />
      <main className="home__main" id="main">
        <Empty icon="alert" title={t.app.not_found} actions={<LinkButton to="/" icon="chevron-left">{t.app.to_home}</LinkButton>} />
      </main>
    </div>
  );
}
