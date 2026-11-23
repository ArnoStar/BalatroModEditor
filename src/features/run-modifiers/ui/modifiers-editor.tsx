// Run modifiers: one vocabulary for a mod's house rules, a deck's start, a
// joker's changes while in play and the "change the run" action. Each row is
// a modifier and its amount (added; probabilities and blind size multiply).
import { use_field_issues } from '@/entities/project';
import { useI18n } from '@/shared/i18n';
import { NOT_PASSIVE, RUN_MODIFIERS, START_ONLY, type Expr, type ModifierContext, type Scope } from '@/shared/lib/mod';
import { Button, ExpressionInput, Field, IconButton, Menu, NumberInput, type LiteralKind, type LiteralOption } from '@/shared/ui';

const MULTIPLIES = ['probability_mult', 'blind_scale'];

function Row({ k, v, path, scope, values, literals, onChange, onRemove }: {
  k: string; v: Expr; path: string; scope?: Scope; values?: Record<string, unknown>;
  literals?: (kind: LiteralKind) => LiteralOption[]; onChange: (v: Expr) => void; onRemove: () => void;
}) {
  const { t } = useI18n();
  const errors = use_field_issues(`${path}.${k}`);
  return (
    <Field path={`${path}.${k}`} label={t.modifiers.labels[k] ?? k} help={t.modifiers.help[k]} errors={errors} inline
      aside={<IconButton size="sm" icon="trash" label={t.common.remove} onClick={onRemove} />}>
      {(id, d) => (scope ? (
        <ExpressionInput id={id} describedby={d} value={v} onChange={onChange} scope={scope} values={values} literals={literals} multiline={false} />
      ) : (
        <NumberInput id={id} describedby={d} value={typeof v === 'number' ? v : null} step={MULTIPLIES.includes(k) ? 0.5 : 1}
          onChange={(n) => onChange(n ?? 0)} />
      ))}
    </Field>
  );
}

export function ModifiersEditor({ value, onChange, context, path, scope, values, literals }: {
  value: Record<string, Expr> | undefined;
  onChange: (v: Record<string, Expr> | undefined) => void;
  context: ModifierContext;
  path: string;
  /** expressions are allowed (the change-the-run action): their scope */
  scope?: Scope;
  values?: Record<string, unknown>;
  literals?: (kind: LiteralKind) => LiteralOption[];
}) {
  const { t } = useI18n();
  const entries = Object.entries(value ?? {});
  const set = (k: string, v: Expr | undefined) => {
    const next = { ...(value ?? {}) };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(Object.keys(next).length ? next : undefined);
  };
  const allowed = (k: string) => !((context === 'passive' || context === 'action') && START_ONLY.includes(k)) && !(context === 'passive' && NOT_PASSIVE.includes(k));
  const missing = RUN_MODIFIERS.filter((k) => !(k in (value ?? {})));
  return (
    <div className="modifiers">
      {entries.length ? entries.map(([k, v]) => (
        <Row key={k} k={k} v={v} path={path} scope={scope} values={values} literals={literals}
          onChange={(x) => set(k, x)} onRemove={() => set(k, undefined)} />
      )) : <p className="muted small">{t.modifiers.none}</p>}
      {missing.length ? (
        <Menu label={t.modifiers.add} width={320} items={missing.map((k) => ({
          label: t.modifiers.labels[k] ?? k,
          hint: allowed(k) ? t.modifiers.help[k] : START_ONLY.includes(k) ? t.modifiers.start_only : t.modifiers.not_passive,
          disabled: !allowed(k),
          onSelect: () => set(k, MULTIPLIES.includes(k) ? 2 : 1),
        }))} trigger={(p) => <Button size="sm" icon="plus" tone="ghost" {...p}>{t.modifiers.add}</Button>} />
      ) : null}
    </div>
  );
}
