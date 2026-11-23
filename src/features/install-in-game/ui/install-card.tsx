import { useEffect, useState } from 'react';
import { useProject } from '@/entities/project';
import { GAME_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { package_hash } from '@/shared/lib/mod';
import { AnchorButton, Button, Notice, Toggle } from '@/shared/ui';
import { install, installed_copy, uninstall } from '../model/install';

/** install, update or remove the mod in the game, and open the game */
export function InstallInGame() {
  const { t, describe } = useI18n();
  const { pkg, errors, project } = useProject();
  const [copy, setCopy] = useState<{ version: string; hash: string } | null | undefined>(undefined);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creative, setCreative] = useState(!pkg.creative);
  const [error, setError] = useState<unknown>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void installed_copy(pkg.id).then((m) => { if (alive) setCopy(m ? { version: m.version, hash: m.hash } : null); });
    void package_hash(pkg).then((h) => { if (alive) setHash(h); });
    return () => { alive = false; };
  }, [pkg]);

  const act = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setSaid(null);
    try { await f(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const outdated = copy && hash && copy.hash !== hash;
  return (
    <div className="install">
      <p className="muted">{t.test.install.text}</p>
      {copy ? <Notice tone={outdated ? 'warning' : 'ok'}>{outdated ? t.test.install.outdated : t.test.install.installed(copy.version)}</Notice> : null}
      {errors > 0 ? <Notice tone="warning">{t.test.server.local_first}</Notice> : null}
      <Toggle checked={creative || !!pkg.creative} disabled={!!pkg.creative} onChange={setCreative} label={t.test.install.with_creative} />
      <div className="install__row">
        <Button tone="primary" icon="download" busy={busy} disabled={errors > 0}
          onClick={() => void act(async () => {
            const m = await install(pkg, project.published?.hash, creative);
            setCopy({ version: m.version, hash: m.hash });
          })}>
          {copy ? t.test.install.update : t.test.install.button}
        </Button>
        <AnchorButton icon="play" href={`${GAME_URL}/`} target="_blank" rel="noopener">{t.test.install.open}</AnchorButton>
        {copy ? (
          <Button tone="ghost" icon="trash" disabled={busy}
            onClick={() => void act(async () => { await uninstall(pkg.id); setCopy(null); setSaid(t.test.install.removed); })}>
            {t.test.install.remove}
          </Button>
        ) : null}
      </div>
      {said ? <p className="muted small" role="status">{said}</p> : null}
      {error ? <Notice tone="error">{describe(error)}</Notice> : null}
    </div>
  );
}
