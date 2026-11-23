import { useI18n } from '@/shared/i18n';
import { Icon } from '@/shared/ui';
import { useSession } from '../model/session';

/** who is signed in, or a link to sign in (the portal's page) */
export function Account() {
  const { t } = useI18n();
  const { status, account, sign_in_url, auth } = useSession();
  if (status === 'signed-in' && account) return <span className="account" title={t.app.account}><Icon name="user" size={16} />{account.display_name}</span>;
  if (status === 'loading' || auth === 'off') return null;
  return <a className="account account--out" href={sign_in_url}><Icon name="login" size={16} />{t.app.sign_in}</a>;
}
