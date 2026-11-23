// Everything a content mod can hold, from the same tables the checks use:
// the package and its items, triggers and what they read, actions and where
// they go, run modifiers, the expression language, the text markup, the
// game's keys (searchable), and a place to try an expression.
import { useMemo, useState } from 'react';
import { ItemPicture, useCatalog, type PickKind } from '@/entities/catalog';
import { SiteBar } from '@/widgets/site-bar';
import { useI18n } from '@/shared/i18n';
import { copy_text } from '@/shared/lib';
import {
  ACTIONS, check, COLOUR_NAMES, GAME_FUNCTIONS, HAND_FUNCTIONS, LAZY_FUNCTIONS, loc_colour, NOT_PASSIVE, parse, POKER_HANDS, PURE_FUNCTIONS,
  RANDOM_FUNCTIONS, RUN_MODIFIERS, SCORING_ACTIONS, scope_for, START_ONLY, ExprError, type ScopeKind,
} from '@/shared/lib/mod';
import { ExpressionInput, GameText, Icon, Notice, Select, TextInput, useToast, use_game_font } from '@/shared/ui';

const TRIGGER_ORDER = ['hand_played', 'card_scored', 'card_held', 'retrigger_scored', 'retrigger_held', 'score', 'other_joker', 'hand_finished',
  'card_destroy', 'hand_not_allowed', 'discard_start', 'discard', 'round_end', 'cash_out', 'blind_selected', 'first_hand_drawn', 'shop_reroll',
  'shop_exit', 'blind_skipped', 'pack_opened', 'pack_skipped', 'card_bought', 'card_sold', 'sold', 'consumable_used', 'cards_added', 'cards_destroyed'];

function reads(trigger: string) {
  return [...scope_for('joker', trigger, {}).roots.keys()].filter((r) => !['self', 'game', 'joker', 'jokers', 'consumables', 'full_deck', 'deck', 'held'].includes(r));
}

function where_action(name: string): string[] {
  if (['chips', 'mult', 'xmult'].includes(name)) return Object.entries(SCORING_ACTIONS).filter(([, s]) => s.includes(name)).map(([k]) => k);
  if (name === 'retrigger') return ['retrigger_scored', 'retrigger_held'];
  if (name === 'destroy_card') return ['discard'];
  return [];
}

function Keys() {
  const { t } = useI18n();
  const cat = useCatalog();
  const toast = useToast();
  const [q, setQ] = useState('');
  const groups: { id: string; items: { key: string; name: string; item?: Parameters<typeof ItemPicture>[0]['item'] }[] }[] = useMemo(() => {
    const pick = (k: PickKind) => cat.items(k).map((x) => ({ key: x.key, name: x.name, item: x }));
    return [
      { id: 'jokers', items: pick('jokers') }, { id: 'tarots', items: pick('tarots') }, { id: 'planets', items: pick('planets') },
      { id: 'spectrals', items: pick('spectrals') }, { id: 'vouchers', items: pick('vouchers') }, { id: 'decks', items: pick('decks') },
      { id: 'blinds', items: pick('blinds') }, { id: 'tags', items: pick('tags') }, { id: 'enhancements', items: pick('enhancements') },
      { id: 'editions', items: ['foil', 'holo', 'polychrome', 'negative'].map((e) => ({ key: e, name: e })) },
      { id: 'seals', items: ['Gold', 'Red', 'Blue', 'Purple'].map((e) => ({ key: e, name: `${e} Seal` })) },
      { id: 'hands', items: POKER_HANDS.map((h) => ({ key: h, name: cat.hand_name(h) })) },
      { id: 'messages', items: cat.messages.map((m) => ({ key: m.key, name: m.text })) },
    ];
  }, [cat]);
  const s = q.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, items: s ? g.items.filter((x) => x.key.toLowerCase().includes(s) || x.name.toLowerCase().includes(s)) : g.items })).filter((g) => g.items.length);
  return (
    <>
      <div className="ref-search"><Icon name="search" size={16} /><TextInput value={q} onChange={setQ} placeholder={t.reference.keys_search} aria-label={t.reference.keys_search} /></div>
      {cat.status === 'offline' ? <Notice tone="warning">{t.reference.keys_offline}</Notice> : null}
      {!shown.length ? <p className="muted">{t.reference.keys_none}</p> : shown.map((g) => (
        <div key={g.id} className="ref-keys">
          <h3>{t.reference.key_groups[g.id] ?? g.id} <span className="muted">{g.items.length}</span></h3>
          <div className="ref-keys__grid">
            {g.items.slice(0, s ? 200 : 60).map((x) => (
              <button key={x.key} type="button" className="ref-key" title={t.common.copy} onClick={() => void copy_text(x.key).then(() => toast(`${t.common.copied}: ${x.key}`, 'ok'))}>
                {x.item ? <ItemPicture item={x.item} scale={0.36} /> : null}
                <span className="ref-key__text"><span>{x.name}</span><code>{x.key}</code></span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Playground() {
  const { t } = useI18n();
  const [kind, setKind] = useState<ScopeKind>('joker');
  const [trigger, setTrigger] = useState('card_scored');
  const [src, setSrc] = useState<string | number | boolean>("card.rank == 7 and is_suit(card, 'Hearts')");
  const scope = scope_for(kind, kind === 'joker' ? trigger : null, { mult: 4, odds: 4 });
  let problems: string[] = [];
  try {
    problems = check(parse(src), scope).map((m) => t.problems.message(m));
  } catch (e) {
    if (e instanceof ExprError) problems = [t.problems.message(e.msg)];
  }
  return (
    <div className="playground">
      <div className="grid-3">
        <Select<ScopeKind> label={t.reference.playground_scope} value={kind} onChange={setKind}
          options={(['joker', 'consumable', 'voucher', 'deck', 'blind_card', 'blind_hand', 'modify'] as ScopeKind[]).map((k) => ({ value: k, label: k }))} />
        {kind === 'joker' ? <Select<string> label={t.reference.playground_trigger} value={trigger} onChange={setTrigger} options={TRIGGER_ORDER.map((x) => ({ value: x, label: `${x} — ${t.triggers[x]?.label ?? ''}` }))} /> : <span />}
        <span className="muted small">self: mult = 4, odds = 4</span>
      </div>
      <ExpressionInput value={src} onChange={setSrc} scope={scope} values={{ mult: 4, odds: 4 }} label={t.reference.sections.playground} />
      {problems.length ? <Notice tone="error">{problems.map((p, i) => <p key={i}>{p}</p>)}</Notice> : <Notice tone="ok">{t.reference.playground_ok}</Notice>}
      <p className="muted small">{t.expr.sample_note}</p>
    </div>
  );
}

export function ReferencePage() {
  const { t } = useI18n();
  use_game_font();
  const r = t.reference;
  const sections = Object.entries(r.sections) as [keyof typeof r.sections, string][];
  const fn_rows = [
    ...Object.entries(PURE_FUNCTIONS).map(([k]) => k), ...Object.keys(LAZY_FUNCTIONS), ...Object.keys(GAME_FUNCTIONS), ...Object.keys(HAND_FUNCTIONS),
    ...Object.keys(RANDOM_FUNCTIONS),
  ];
  return (
    <div className="home">
      <SiteBar />
      <div className="ref">
        <nav className="ref__toc" aria-label={r.toc}>
          <p className="ref__toc-title">{r.toc}</p>
          {sections.map(([k, v]) => <a key={k} href={`#${k}`}>{v}</a>)}
        </nav>
        <main className="ref__main" id="main">
          <h1 className="hero__title">{r.title}</h1>
          <p className="hero__lead">{r.lead}</p>

          <h2 id="package">{r.sections.package}</h2>
          <table className="ref-table"><thead><tr><th>{r.field}</th><th>{r.meaning}</th></tr></thead><tbody>
            {Object.entries(r.package_fields).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}
          </tbody></table>

          <h2 id="items">{r.sections.items}</h2>
          <table className="ref-table"><thead><tr><th>{r.field}</th><th>{r.meaning}</th></tr></thead><tbody>
            {Object.entries(r.item_fields).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}
          </tbody></table>

          <h2 id="jokers">{r.sections.jokers}</h2>
          <table className="ref-table"><tbody>
            <tr><td><code>rarity</code></td><td>{t.items.rarities.map((x, i) => `${i + 1} ${x}`).join(', ')} — {t.items.legendary_help}</td></tr>
            <tr><td><code>cost</code></td><td>{t.items.cost_help} (5)</td></tr>
            <tr><td><code>config</code></td><td>{t.items.config_help}</td></tr>
            <tr><td><code>blueprint_compat</code>, <code>eternal_compat</code>, <code>perishable_compat</code></td><td>{t.items.blueprint_compat}; {t.items.eternal_compat}; {t.items.perishable_compat} (true)</td></tr>
            <tr><td><code>in_shop</code></td><td>{t.items.in_shop_help} (true)</td></tr>
            <tr><td><code>passive</code></td><td>{t.items.passive_help}</td></tr>
            <tr><td><code>effects</code></td><td>{t.items.effects_help}</td></tr>
          </tbody></table>

          <h2 id="triggers">{r.sections.triggers}</h2>
          <table className="ref-table"><thead><tr><th>{r.trigger}</th><th>{r.when}</th><th>{r.reads}</th></tr></thead><tbody>
            {TRIGGER_ORDER.map((x) => <tr key={x}><td><code>{x}</code><br /><span className="muted small">{t.triggers[x]?.label}</span></td><td>{t.triggers[x]?.when}</td><td>{reads(x).map((n) => <code key={n}>{n} </code>)}</td></tr>)}
          </tbody></table>

          <h2 id="actions">{r.sections.actions}</h2>
          <table className="ref-table"><thead><tr><th>{r.action}</th><th>{r.meaning}</th><th>{r.where}</th></tr></thead><tbody>
            {ACTIONS.map((a) => (
              <tr key={a}><td><code>{a}</code><br /><span className="muted small">{t.actions[a]?.label}</span></td><td>{t.actions[a]?.help}</td>
                <td>{where_action(a).length ? where_action(a).map((w) => <code key={w}>{w} </code>) : a === 'set' || a === 'destroy_self' ? r.jokers_only : r.anywhere}</td></tr>
            ))}
          </tbody></table>

          <h2 id="consumables">{r.sections.consumables}</h2>
          <table className="ref-table"><tbody>
            <tr><td><code>set</code></td><td>Tarot, Planet, Spectral</td></tr>
            <tr><td><code>hand</code></td><td>{t.items.planet_hand}</td></tr>
            <tr><td><code>targets</code></td><td>{t.items.targets}: {'{"min": 1, "max": 2}'}</td></tr>
            <tr><td><code>can_use</code></td><td>{t.items.can_use} — {t.items.can_use_help}</td></tr>
            <tr><td><code>use</code></td><td>{t.items.use_help}</td></tr>
          </tbody></table>

          <h2 id="vouchers">{r.sections.vouchers}</h2>
          <table className="ref-table"><tbody>
            <tr><td><code>cost</code></td><td>10</td></tr>
            <tr><td><code>requires</code></td><td>{t.items.requires_help}</td></tr>
            <tr><td><code>redeem</code></td><td>{t.items.redeem_help}</td></tr>
          </tbody></table>

          <h2 id="decks">{r.sections.decks}</h2>
          <table className="ref-table"><tbody>
            <tr><td><code>start</code></td><td>{t.items.start_help}</td></tr>
            <tr><td><code>jokers</code>, <code>consumables</code>, <code>vouchers</code></td><td>{t.items.sections.starting_items}</td></tr>
            <tr><td><code>cards</code></td><td><code>ranks</code> / <code>no_ranks</code>, <code>suits</code> / <code>no_suits</code>, <code>enhancement</code>, <code>edition</code>, <code>seal</code></td></tr>
          </tbody></table>

          <h2 id="blinds">{r.sections.blinds}</h2>
          <table className="ref-table"><tbody>
            <tr><td><code>mult</code></td><td>{t.items.blind_mult_help} (2)</td></tr>
            <tr><td><code>dollars</code></td><td>{t.items.blind_dollars} (5)</td></tr>
            <tr><td><code>min_ante</code>, <code>max_ante</code></td><td>1, 10</td></tr>
            <tr><td><code>showdown</code></td><td>{t.items.showdown_help}</td></tr>
            <tr><td><code>colour</code></td><td>#rrggbb</td></tr>
            <tr><td><code>debuff_card</code></td><td>{t.items.debuff_card_help}</td></tr>
            <tr><td><code>debuff_hand</code></td><td>{t.items.debuff_hand_help}</td></tr>
            <tr><td><code>on_set</code></td><td>{t.items.on_set_help} (hands, discards, hand_size, dollars, message)</td></tr>
            <tr><td><code>on_hand</code></td><td>{t.items.on_hand_help} (dollars, message)</td></tr>
          </tbody></table>

          <h2 id="modifiers">{r.sections.modifiers}</h2>
          <table className="ref-table"><thead><tr><th>{r.modifier}</th><th>{r.meaning}</th><th>{r.contexts}</th></tr></thead><tbody>
            {RUN_MODIFIERS.map((m) => (
              <tr key={m}><td><code>{m}</code><br /><span className="muted small">{t.modifiers.labels[m]}</span></td><td>{t.modifiers.help[m]}</td>
                <td>{START_ONLY.includes(m) ? t.modifiers.start_only : NOT_PASSIVE.includes(m) ? t.modifiers.not_passive : r.anywhere}</td></tr>
            ))}
          </tbody></table>

          <h2 id="expressions">{r.sections.expressions}</h2>
          <ul className="ref-list">{r.expression_rules.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <pre className="json">{`card.rank == 7 and is_suit(card, 'Hearts')\nself.mult + 2 * count_face(scoring)\nif(game.money > 20, 3, 1)`}</pre>

          <h2 id="names">{r.sections.names}</h2>
          <table className="ref-table"><thead><tr><th>{r.name}</th><th>{r.meaning}</th></tr></thead><tbody>
            {Object.entries(t.expr.roots).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}
          </tbody></table>
          {Object.entries(t.expr.fields).map(([root, fields]) => (
            <details key={root} className="ref-details">
              <summary><code>{root}.…</code></summary>
              <table className="ref-table"><tbody>{Object.entries(fields).map(([k, v]) => <tr key={k}><td><code>{root}.{k}</code></td><td>{v}</td></tr>)}</tbody></table>
            </details>
          ))}

          <h2 id="functions">{r.sections.functions}</h2>
          <table className="ref-table"><thead><tr><th>{r.function}</th><th>{r.meaning}</th></tr></thead><tbody>
            {fn_rows.map((k) => <tr key={k}><td><code>{t.expr.functions[k]?.sig ?? k}</code></td><td>{t.expr.functions[k]?.help}</td></tr>)}
          </tbody></table>

          <h2 id="markup">{r.sections.markup}</h2>
          <table className="ref-table"><tbody>{Object.entries(r.markup_rows).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}</tbody></table>
          <div className="ref-colours">
            {COLOUR_NAMES.map((c) => (
              <span key={c} className="ref-colour">
                <span className="ref-colour__swatch" style={{ background: loc_colour(c) }} />
                <code>{c}</code>
                <span className="ref-colour__sample"><GameText lines={[`{C:${c}}${t.markup.colours[c] ?? c}{}`]} /></span>
              </span>
            ))}
          </div>
          <div className="ref-sample">
            <GameText lines={['{C:mult}+#1#{} Mult', '{X:mult,C:white} X#2# {} Mult', '{C:green}#3# in #4#{} chance', '{C:inactive}(Currently {C:chips}+#5#{C:inactive} Chips)']} vars={['4', '1.5', '1', '4', '20']} />
          </div>

          <h2 id="keys">{r.sections.keys}</h2>
          <p className="muted">{r.messages_note}</p>
          <Keys />

          <h2 id="playground">{r.sections.playground}</h2>
          <Playground />
        </main>
      </div>
    </div>
  );
}
