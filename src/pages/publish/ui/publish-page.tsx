// Publishing: the mod in the registry, where every player installs it from
// the game's MODS menu. Its id becomes the publisher's; versions only go up;
// a published version never changes (runs replay with exactly it).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { focus_path, route_of, useProject } from '@/entities/project';
import { use_registry } from '@/entities/registry';
import { useSession } from '@/entities/session';
import { InstallInGame } from '@/features/install-in-game';
import { split_error } from '@/features/server-check';
import { mods_api, ProblemError } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { bump, KINDS, newer, package_hash, type AnyItem } from '@/shared/lib/mod';
import { Button, Icon, Notice, Section, useConfirm, useToast } from '@/shared/ui';

function Check({ ok, optional, children }: { ok: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <li className={`check ${ok ? 'is-ok' : optional ? 'is-optional' : 'is-bad'}`}>
      <Icon name={ok ? 'check' : optional ? 'info' : 'x'} size={15} />
      <span>{children}</span>
    </li>
  );
}

export function PublishPage() {
  const { t, f, describe } = useI18n();
  const { pkg, errors, project, set, set_published } = useProject();
  const { status, account, auth, can_act, sign_in_url } = useSession();
  const reg = use_registry(pkg.id);
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const latest = reg.k === 'yours' ? reg.mod.version : null;
  const version_ok = !latest || newer(pkg.version, latest);
  const pictures = KINDS.filter((k) => k === 'jokers' || k === 'consumables' || k === 'vouchers')
    .every((k) => ((pkg[k] ?? []) as AnyItem[]).every((it) => it?.sprite !== undefined));
  const translated = !!pkg.loc && Object.keys(pkg.loc).length > 0;
  const blocked = errors > 0 || !version_ok || reg.k === 'taken' || reg.k === 'official' || !can_act;

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await mods_api.publish(pkg);
      set_published({ version: d.version, hash: d.hash || (await package_hash(pkg)), at: Date.now() });
      toast(t.publish.published(d.version), 'ok');
      reg.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const unlist = async () => {
    if (!(await confirm(t.publish.unlist_confirm, { ok: t.publish.unlist }))) return;
    try {
      await mods_api.unlist(pkg.id);
      toast(t.publish.unlisted, 'ok');
      reg.reload();
    } catch (e) {
      toast(describe(e), 'error');
    }
  };
  const go = (path: string) => { navigate(`/p/${project.id}/${route_of(path)}`); setTimeout(() => focus_path(path), 30); };
  const engine_errors = error instanceof ProblemError && Array.isArray((error.problem as { errors?: unknown }).errors)
    ? ((error.problem as unknown as { errors: unknown[] }).errors.filter((x) => typeof x === 'string') as string[]) : [];

  const status_line = reg.k === 'free' ? t.publish.status_new : reg.k === 'yours' ? t.publish.status_yours(reg.mod.version)
    : reg.k === 'taken' ? t.publish.status_taken : reg.k === 'official' ? t.publish.status_official : t.publish.status_checking;
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title"><Icon name="rocket" size={22} />{t.publish.title}</h1>
          <p className="page__lead">{t.publish.lead}</p>
        </div>
      </header>

      <Section title={pkg.name} id="publish">
        {status === 'signed-in' && account ? <p className="muted">{t.publish.signed_in(account.display_name)}</p>
          : auth === 'off' ? <Notice>{t.publish.auth_off}</Notice>
            : status === 'signed-out' ? <Notice tone="warning">{t.publish.sign_in_needed} <a href={sign_in_url}>{t.publish.sign_in}</a></Notice> : null}
        <p className={`publish-status publish-status--${reg.k}`}><Icon name={reg.k === 'taken' || reg.k === 'official' ? 'alert' : 'info'} size={15} /> {status_line}</p>
        <h3 className="sub">{t.publish.checklist}</h3>
        <ul className="checks">
          <Check ok={errors === 0}>{t.publish.check_valid}{errors ? ` — ${t.common.errors_n(errors)}` : ''}</Check>
          <Check ok={version_ok}>
            {t.publish.check_version}{!version_ok && latest ? <> — {t.publish.must_be_higher(latest)} <button type="button" className="link" onClick={() => set(['version'], bump(latest, 'patch'))}>{bump(latest, 'patch')}</button></> : ` (${pkg.version})`}
          </Check>
          <Check ok={!!pkg.description?.trim()} optional>{t.publish.check_description}</Check>
          <Check ok={pictures} optional>{t.publish.check_art}</Check>
          <Check ok={translated} optional>{t.publish.check_translations}</Check>
        </ul>
        <div className="publish-row">
          <Button tone="gold" size="lg" icon="rocket" busy={busy} disabled={blocked} onClick={() => void publish()}>
            {busy ? t.publish.publishing : t.publish.publish(pkg.version)}
          </Button>
          {reg.k === 'yours' ? <Button tone="ghost" icon="eye-off" onClick={() => void unlist()}>{t.publish.unlist}</Button> : null}
        </div>
        {error ? (
          <Notice tone="error">
            <p>{describe(error)}</p>
            {engine_errors.length ? (
              <ul className="server-check__errors">
                {engine_errors.map((e, i) => {
                  const { path, text } = split_error(e);
                  return <li key={i}>{path ? <button type="button" className="link" onClick={() => go(path)}><code>{path}</code></button> : null}{path ? ': ' : ''}{text}</li>;
                })}
              </ul>
            ) : null}
          </Notice>
        ) : null}
      </Section>

      {reg.k === 'yours' || reg.k === 'taken' || reg.k === 'official' ? (
        <Section title={t.publish.versions} actions={<span className="badge badge--neutral">{t.publish.installs(reg.mod.installs)}</span>}>
          <ul className="versions">
            {reg.mod.versions.map((v) => (
              <li key={v.version}>
                <b>{t.common.version(v.version)}</b>
                <span className="muted small">{f.datetime(v.created_at)} · {f.bytes(v.size)}</span>
                <code className="muted small">{v.hash.slice(0, 12)}</code>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t.test.install.title}>
        <InstallInGame />
      </Section>
    </div>
  );
}
