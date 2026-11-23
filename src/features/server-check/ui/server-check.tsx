import { useNavigate } from 'react-router';
import { focus_path, route_of, useProject } from '@/entities/project';
import { useI18n } from '@/shared/i18n';
import { Button, Icon, Notice } from '@/shared/ui';
import { split_error, use_server_check } from '../model/check';

/** the check's button and what the server said (each problem opens its place) */
export function ServerCheck({ compact }: { compact?: boolean }) {
  const { t, describe } = useI18n();
  const { errors, project } = useProject();
  const navigate = useNavigate();
  const { run, running, error, result, stale } = use_server_check();
  const go = (path: string) => { navigate(`/p/${project.id}/${route_of(path)}`); setTimeout(() => focus_path(path), 30); };
  return (
    <div className={['server-check', compact ? 'server-check--compact' : ''].filter(Boolean).join(' ')}>
      <div className="server-check__row">
        <Button icon="shield" tone="primary" busy={running} disabled={errors > 0} onClick={() => void run()}>
          {running ? t.test.server.running : t.test.server.run}
        </Button>
        {errors > 0 ? <span className="muted">{t.test.server.local_first}</span> : null}
      </div>
      {error ? <Notice tone="error">{describe(error)}</Notice> : null}
      {result && !error ? (
        <div className={stale ? 'is-stale' : undefined}>
          {stale ? <p className="muted small">{t.problems.stale}</p> : null}
          {result.valid ? (
            <Notice tone="ok">{t.test.server.ok}</Notice>
          ) : (
            <Notice tone="error">
              <p>{t.test.server.failed}</p>
              <ul className="server-check__errors">
                {result.errors.map((e, i) => {
                  const { path, text } = split_error(e);
                  return (
                    <li key={i}>
                      {path ? <button type="button" className="link" onClick={() => go(path)}><code>{path}</code></button> : null}
                      {path ? ': ' : null}{text}
                    </li>
                  );
                })}
              </ul>
            </Notice>
          )}
        </div>
      ) : null}
      {!result && !error && !running ? <p className="muted small"><Icon name="info" size={14} /> {t.test.server.text}</p> : null}
    </div>
  );
}
