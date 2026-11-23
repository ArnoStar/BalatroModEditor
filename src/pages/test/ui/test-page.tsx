// Trying the mod in the real engine: the server's check, the game itself
// (installed in this browser), and the scoring lab.
import { InstallInGame } from '@/features/install-in-game';
import { ServerCheck } from '@/features/server-check';
import { useI18n } from '@/shared/i18n';
import { Icon, Section } from '@/shared/ui';
import { ScoringLab } from './lab';

export function TestPage() {
  const { t } = useI18n();
  return (
    <div className="page page--test">
      <header className="page__head">
        <div>
          <h1 className="page__title"><Icon name="flask" size={22} />{t.test.title}</h1>
          <p className="page__lead">{t.test.lead}</p>
        </div>
      </header>
      <Section title={t.test.lab.title} help={t.test.lab.text} id="lab" tone="#4bc292">
        <ScoringLab />
      </Section>
      <div className="grid-2 grid-2--top">
        <Section title={t.test.server.title} id="server"><ServerCheck /></Section>
        <Section title={t.test.install.title} id="install"><InstallInGame /></Section>
      </div>
    </div>
  );
}
