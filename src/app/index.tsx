import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';
import { CatalogProvider } from '@/entities/catalog';
import { SessionProvider } from '@/entities/session';
import { I18nProvider, useI18n } from '@/shared/i18n';
import { ConfirmProvider, ToastProvider } from '@/shared/ui';
import { Router } from './router';

function Confirm({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return <ConfirmProvider ok={t.common.delete} cancel={t.common.cancel} title={t.common.sure}>{children}</ConfirmProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <Confirm>
          <SessionProvider>
            <CatalogProvider>
              <Router />
            </CatalogProvider>
          </SessionProvider>
        </Confirm>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
);
