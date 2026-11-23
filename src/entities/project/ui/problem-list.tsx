// A package's problems, each with its place; choosing one opens its page and
// shows the field.
import { useNavigate } from 'react-router';
import { useI18n } from '@/shared/i18n';
import { Icon } from '@/shared/ui';
import type { Issue } from '@/shared/lib/mod';
import { useProject } from '../model/context';
import { place_of } from '../lib/places';
import { focus_path, route_of } from '../lib/routes';

export function ProblemList({ issues, onPick, compact }: { issues: Issue[]; onPick?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const { pkg, project } = useProject();
  const navigate = useNavigate();
  const go = (path: string) => {
    onPick?.();
    navigate(`/p/${project.id}/${route_of(path)}`);
    setTimeout(() => focus_path(path), 30);
  };
  return (
    <ul className={['problems', compact ? 'problems--compact' : ''].filter(Boolean).join(' ')}>
      {issues.map((i, n) => {
        const place = place_of(i.path, pkg, t);
        return (
          <li key={n}>
            <button type="button" className={`problem problem--${i.level}`} onClick={() => go(i.path)}>
              <Icon name={i.level === 'error' ? 'alert' : 'info'} size={15} />
              <span className="problem__body">
                <span className="problem__place">
                  {place.item ? <strong>{place.item}</strong> : null}
                  {place.item ? ' · ' : null}
                  {place.field}
                </span>
                <span className="problem__text">{t.problems.message(i.msg)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
