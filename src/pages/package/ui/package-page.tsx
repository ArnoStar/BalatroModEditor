// The mod as the engine reads it: its JSON (to read, copy, download, or edit
// by hand), its size, its content hash, and every problem.
import { useEffect, useMemo, useState } from 'react';
import { ProblemList, useProject } from '@/entities/project';
import { ExportButton } from '@/features/export-mod';
import { useI18n } from '@/shared/i18n';
import { copy_text } from '@/shared/lib';
import { logic, MAX_PACKAGE_BYTES, package_hash, py_dumps, utf8_size, type ModPackage } from '@/shared/lib/mod';
import { Button, Empty, Icon, JsonView, Notice, Section, useToast } from '@/shared/ui';

export function PackagePage() {
  const { t, f } = useI18n();
  const { pkg, change, issues } = useProject();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string>('');
  const text = useMemo(() => JSON.stringify(pkg, null, 2), [pkg]);
  const size = useMemo(() => utf8_size(py_dumps(pkg)), [pkg]);
  const logic_size = useMemo(() => utf8_size(py_dumps(logic(pkg as unknown as Record<string, unknown>))), [pkg]);
  useEffect(() => { void package_hash(pkg).then(setHash); }, [pkg]);
  const apply = () => {
    try {
      const data = JSON.parse(draft);
      if (!data || typeof data !== 'object' || Array.isArray(data)) { setError(t.package.json_not_object); return; }
      change(() => ({ ...(data as ModPackage), assets: (data as ModPackage).assets ?? {} }));
      setEditing(false);
      setError(null);
      toast(t.package.applied, 'ok');
    } catch (e) {
      setError(t.package.json_error((e as Error).message));
    }
  };
  const pct = Math.min(100, (size / MAX_PACKAGE_BYTES) * 100);
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title"><Icon name="package" size={22} />{t.package.title}</h1>
          <p className="page__lead">{t.package.lead}</p>
        </div>
        <div className="page__tools">
          <Button icon="copy" onClick={() => void copy_text(text).then((ok) => toast(ok ? t.common.copied : t.errors.unknown, ok ? 'ok' : 'error'))}>{t.package.copy}</Button>
          <ExportButton pkg={pkg} tone="primary" />
        </div>
      </header>
      <div className="facts">
        <div className="fact">
          <span className="fact__label">{t.package.size}</span>
          <span className="fact__value">{f.bytes(size)} <span className="muted">/ {f.bytes(MAX_PACKAGE_BYTES)}</span></span>
          <span className="meter"><span style={{ width: `${pct}%` }} className={pct > 90 ? 'is-bad' : ''} /></span>
          <span className="fact__help">{t.package.size_help}</span>
        </div>
        <div className="fact">
          <span className="fact__label">{t.package.logic}</span>
          <span className="fact__value">{f.bytes(logic_size)}</span>
        </div>
        <div className="fact">
          <span className="fact__label">{t.package.hash}</span>
          <code className="fact__value fact__value--mono">{hash ? `${hash.slice(0, 16)}…` : '…'}</code>
          <span className="fact__help">{t.package.hash_help}</span>
        </div>
      </div>
      <Section title={t.workspace.problems_title} help={t.workspace.problems_note}>
        {issues.length ? <ProblemList issues={issues} /> : <Empty icon="check" title={t.workspace.problems_none} />}
      </Section>
      <Section title={t.package.json} actions={editing ? (
        <>
          <Button tone="ghost" onClick={() => { setEditing(false); setError(null); }}>{t.common.cancel}</Button>
          <Button tone="primary" icon="check" onClick={apply}>{t.package.apply_json}</Button>
        </>
      ) : <Button icon="code" onClick={() => { setDraft(text); setEditing(true); }}>{t.package.edit_json}</Button>}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {editing ? <textarea className="input input--code" value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} aria-label={t.package.json} />
          : <JsonView text={text} className="json--page" />}
      </Section>
    </div>
  );
}
