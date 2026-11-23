import { useMemo } from 'react';
import { useI18n } from '@/shared/i18n';
import { useProject } from './context';

/** the problems at a place of the package (or inside it), in the player's words, for a Field */
export function use_field_issues(path: string, under = false): { text: string; level: 'error' | 'warning' }[] {
  const { t } = useI18n();
  const { issues_at, issues_under, issues } = useProject();
  return useMemo(
    () => (under ? issues_under(path) : issues_at(path)).map((i) => ({ text: t.problems.message(i.msg), level: i.level })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [issues, path, under, t],
  );
}
