// The scoring lab: a real run of the engine with the mod and Creative mode.
// Put any cards in play, play hands, and see what each card and joker adds, in
// the order the game scores them; win rounds, shop, open packs, try bosses.
import { useMemo, useRef, useState } from 'react';
import { KeyPicker, item_look, useCatalog, type PickItem } from '@/entities/catalog';
import { useProject } from '@/entities/project';
import { useSession } from '@/entities/session';
import type { CardView, GameEvent, LegalAction } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { EDITIONS, ENHANCEMENTS, full_key, KINDS, POKER_HANDS, RANK_NAMES, SEALS, SUITS, type AnyItem, type ItemKind } from '@/shared/lib/mod';
import {
  Badge, Button, CardArt, Field, Icon, IconButton, Menu, Notice, NumberInput, Popover, Select, Sprite, TextInput, type CardPicture,
} from '@/shared/ui';
import { card_label, use_lab, type Lab, type LogEntry } from '../model/lab';

const C_BASE = { atlas: 'centers', x: 1, y: 0 };

function use_card_look() {
  const cat = useCatalog();
  const { pkg } = useProject();
  return useMemo(() => {
    const own = new Map<string, { kind: ItemKind; item: AnyItem }>();
    for (const k of KINDS) for (const it of (pkg[k] ?? []) as AnyItem[]) if (it?.key) own.set(full_key(pkg.id, k, it.key), { kind: k, item: it });
    const picture = (key: string | null): CardPicture | null => {
      if (!key) return null;
      const o = own.get(key);
      if (o) return item_look(o.kind, o.item, pkg.assets, cat).picture;
      return cat.picture(key);
    };
    const front = (card_key: string | null) => {
      const c = cat.catalog?.cards.find((x) => x.key === card_key);
      return c?.sprite ? { atlas: c.sprite.atlas, x: c.sprite.pos.x, y: c.sprite.pos.y } : null;
    };
    const seal = (s: string | null) => {
      const x = cat.catalog?.seals.find((y) => y.key === s);
      return x?.sprite ? { atlas: x.sprite.atlas, x: x.sprite.pos.x, y: x.sprite.pos.y } : null;
    };
    return { picture, front, seal, own };
  }, [cat, pkg]);
}

function Tile({ card, selected, onClick, scale = 0.9, extra }: { card: CardView; selected?: boolean; onClick?: () => void; scale?: number; extra?: React.ReactNode }) {
  const look = use_card_look();
  const label = card_label(card);
  let art: React.ReactNode;
  if (card.kind === 'playing_card') {
    const base = card.enhancement ? look.picture(card.enhancement) : C_BASE;
    const front = card.enhancement === 'm_stone' ? null : look.front(card.card_key);
    const seal = look.seal(card.seal);
    art = (
      <span className="pcard" style={{ width: 71 * scale, height: 95 * scale }}>
        <CardArt picture={base ?? C_BASE} scale={scale} />
        {front ? <span className="pcard__layer"><Sprite atlas={front.atlas} x={front.x} y={front.y} scale={scale} /></span> : null}
        {seal ? <span className="pcard__layer"><Sprite atlas={seal.atlas} x={seal.x} y={seal.y} scale={scale} /></span> : null}
      </span>
    );
  } else {
    art = <CardArt picture={look.picture(card.key)} scale={scale} />;
  }
  return (
    <button type="button" className={['tile', `tile--${card.kind}`, selected ? 'is-selected' : '', card.debuffed ? 'is-debuffed' : '', card.edition ? `is-${card.edition}` : ''].filter(Boolean).join(' ')}
      onClick={onClick} title={`${card.name ?? label}${card.edition ? ` (${card.edition})` : ''}`} aria-pressed={selected}>
      {art}
      {card.edition ? <span className="tile__edition">{card.edition}</span> : null}
      <span className="tile__name">{label}</span>
      {extra}
    </button>
  );
}

/** a joker's values now (a mod's: its config, as this copy has them) */
function Values({ ability }: { ability: Record<string, unknown> | null }) {
  const extra = ability?.extra;
  const values = extra && typeof extra === 'object' ? Object.entries(extra as Record<string, unknown>) : [];
  if (!values.length) return null;
  return (
    <span className="tile__values">
      {values.slice(0, 4).map(([k, v]) => <span key={k}><code>{k}</code> {typeof v === 'number' ? Math.round(v * 100) / 100 : String(v)}</span>)}
    </span>
  );
}

function Log({ log }: { log: LogEntry[] }) {
  const { t, f } = useI18n();
  const ev = t.test.lab.ev;
  const n = (x: number | null) => (x === null ? '' : f.number(x));
  const line = (e: GameEvent, names: Record<number, string>, i: number) => {
    const who = 'card' in e && typeof e.card === 'number' ? names[e.card] ?? `#${e.card}` : null;
    switch (e.type) {
      case 'card_text': {
        const c = e as Extract<GameEvent, { type: 'card_text' }>;
        const text = c.effect === 'chips' ? ev.chips(n(c.amount)) : c.effect === 'mult' ? ev.mult(n(c.amount)) : c.effect === 'x_mult' ? ev.x_mult(n(c.amount))
          : c.effect === 'dollars' ? ev.dollars(n(c.amount)) : c.effect === 'again' ? ev.again : c.effect === 'debuffed' ? ev.debuffed : c.effect === 'swap' ? ev.swap : c.message ?? c.effect;
        return <li key={i} className={`ev ev--${c.effect}`}><span className="ev__who">{who}</span><span className="ev__what">{text}</span>{c.held ? <em>{ev.held}</em> : null}{c.edition ? <em>{ev.edition}</em> : null}</li>;
      }
      case 'hand_scored': {
        const h = e as Extract<GameEvent, { type: 'hand_scored' }>;
        return <li key={i} className="ev ev--scored">{t.test.lab.scored(h.hand, f.number(h.chips), f.number(h.mult), f.number(h.score))}</li>;
      }
      case 'dollars': {
        const d = e as Extract<GameEvent, { type: 'dollars' }>;
        return <li key={i} className="ev ev--dollars"><span className="ev__what">{d.amount > 0 ? '+' : ''}{ev.dollars(n(d.amount))}</span><span className="muted"> → ${n(d.total)}</span></li>;
      }
      case 'status_text': return <li key={i} className="ev ev--status">{(e as { text: string }).text}</li>;
      case 'attention_text': return <li key={i} className="ev ev--status"><span className="ev__who">{who}</span>{(e as { key: string }).key}</li>;
      case 'card_changed': return <li key={i} className="ev ev--changed"><span className="ev__who">{who}</span>{(e as { change: string }).change}</li>;
      case 'card_removed': return <li key={i} className="ev ev--removed"><span className="ev__who">{who}</span><Icon name="trash" size={12} /></li>;
      default: return null;
    }
  };
  if (!log.length) return <p className="muted small">{t.test.lab.log_empty}</p>;
  return (
    <ol className="lab-log">
      {log.map((entry) => (
        <li key={entry.id}>
          <p className="lab-log__title">{entry.title}</p>
          <ul>{entry.events.map((e, i) => line(e, entry.names, i))}</ul>
        </li>
      ))}
    </ol>
  );
}

function AddCard({ lab }: { lab: Lab }) {
  const { t } = useI18n();
  const cat = useCatalog();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [c, setC] = useState({ rank: 'Ace', suit: 'Hearts', enhancement: '', edition: '', seal: '' });
  const L = t.test.lab;
  const add = (to: 'hand' | 'deck') => {
    void lab.creative({ op: 'add_card', rank: c.rank, suit: c.suit, enhancement: c.enhancement || undefined, edition: c.edition || undefined, seal: c.seal || undefined, to }, `${L.add_card}: ${c.rank} ${c.suit}`);
    setOpen(false);
  };
  return (
    <>
      <Button ref={ref} size="sm" icon="card" onClick={() => setOpen((o) => !o)}>{L.add_card}</Button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} width={320}>
        <div className="mini-form">
          <Field label={L.card.rank}>{(id) => <Select<string> id={id} value={c.rank} onChange={(rank) => setC({ ...c, rank })} options={RANK_NAMES.map((r) => ({ value: r, label: cat.term('rank', r) }))} />}</Field>
          <Field label={L.card.suit}>{(id) => <Select<string> id={id} value={c.suit} onChange={(suit) => setC({ ...c, suit })} options={SUITS.map((s) => ({ value: s, label: cat.term('suit', s) }))} />}</Field>
          <Field label={L.card.enhancement}>{(id) => <Select<string> id={id} value={c.enhancement} onChange={(enhancement) => setC({ ...c, enhancement })} options={[{ value: '', label: L.card.none }, ...ENHANCEMENTS.map((e) => ({ value: e, label: cat.term('enhancement', e) }))]} />}</Field>
          <Field label={L.card.edition}>{(id) => <Select<string> id={id} value={c.edition} onChange={(edition) => setC({ ...c, edition })} options={[{ value: '', label: L.card.none }, ...EDITIONS.filter((e) => e !== 'negative').map((e) => ({ value: e, label: cat.term('edition', e) }))]} />}</Field>
          <Field label={L.card.seal}>{(id) => <Select<string> id={id} value={c.seal} onChange={(seal) => setC({ ...c, seal })} options={[{ value: '', label: L.card.none }, ...SEALS.map((e) => ({ value: e, label: cat.term('seal', e) }))]} />}</Field>
          <div className="mini-form__row">
            <Button size="sm" tone="primary" onClick={() => add('hand')} disabled={lab.game?.phase !== 'playing'}>{L.to_hand}</Button>
            <Button size="sm" onClick={() => add('deck')}>{L.to_deck}</Button>
          </div>
        </div>
      </Popover>
    </>
  );
}

function SetValue({ lab }: { lab: Lab }) {
  const { t } = useI18n();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState('money');
  const [value, setValue] = useState<number | null>(100);
  const [hand, setHand] = useState('Pair');
  const [level, setLevel] = useState<number | null>(5);
  const L = t.test.lab;
  return (
    <>
      <Button ref={ref} size="sm" icon="pencil" onClick={() => setOpen((o) => !o)}>{L.set}</Button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} width={320}>
        <div className="mini-form">
          <div className="mini-form__row">
            <Select<string> label={L.set} value={what} onChange={setWhat} options={Object.entries(L.set_what).map(([k, v]) => ({ value: k, label: v }))} />
            <NumberInput label={L.set} value={value} onChange={setValue} integer />
            <Button size="sm" tone="primary" onClick={() => { void lab.creative({ op: 'set', what, value: value ?? 0 }, `${L.set_what[what]} = ${value}`); setOpen(false); }}>{t.common.apply}</Button>
          </div>
          <div className="mini-form__row">
            <Select<string> label={L.level} value={hand} onChange={setHand} options={POKER_HANDS.map((h) => ({ value: h, label: h }))} />
            <NumberInput label={L.level} value={level} onChange={setLevel} integer min={1} />
            <Button size="sm" tone="primary" onClick={() => { void lab.creative({ op: 'level', hand, value: level ?? 1 }, `${hand}: ${L.level} ${level}`); setOpen(false); }}>{t.common.apply}</Button>
          </div>
        </div>
      </Popover>
    </>
  );
}

function CardMenu({ card, lab, actions, area }: { card: CardView; lab: Lab; actions: LegalAction[]; area: 'jokers' | 'consumables' | 'hand' }) {
  const { t } = useI18n();
  const L = t.test.lab;
  const sell = actions.find((a) => a.type === 'sell' && a.card === card.id);
  const use = actions.find((a) => a.type === 'use' && a.card === card.id);
  const items = [
    ...(use ? [{ label: L.use, icon: 'play' as const, onSelect: () => void lab.act({ type: 'use', card: card.id, targets: lab.selected.length ? lab.selected : null }, `${L.use}: ${card_label(card)}`) }] : []),
    ...(sell ? [{ label: `${L.sell} ($${sell.value ?? 0})`, icon: 'coins' as const, onSelect: () => void lab.act({ type: 'sell', card: card.id }, `${L.sell}: ${card_label(card)}`) }] : []),
    ...(area !== 'consumables' ? [{ group: L.edition, label: '' }, ...['none', 'foil', 'holo', 'polychrome', ...(area === 'jokers' ? ['negative'] : [])].map((e) => ({
      label: e, onSelect: () => void lab.creative({ op: 'edit', card: card.id, edition: e }, `${L.edition}: ${card_label(card)} ${e}`),
    }))] : []),
    { label: L.remove, icon: 'trash' as const, danger: true, onSelect: () => void lab.creative({ op: 'remove', card: card.id }, `${L.remove}: ${card_label(card)}`) },
  ];
  return <Menu label={card_label(card)} width={230} items={items} trigger={(p) => <IconButton size="sm" icon="more" label={t.common.more} className="tile__menu" {...p} />} />;
}

export function ScoringLab() {
  const { t, f } = useI18n();
  const { pkg, project, errors } = useProject();
  const { can_act, sign_in_url } = useSession();
  const cat = useCatalog();
  const lab = use_lab(project.id, pkg);
  const L = t.test.lab;
  const own_decks = ((pkg.decks ?? []) as AnyItem[]).map((d) => ({ value: full_key(pkg.id, 'decks', d.key), label: d.name || d.key }));
  const [deck, setDeck] = useState(own_decks[0]?.value ?? 'b_red');
  const [seed, setSeed] = useState('');
  const own = (k: ItemKind): PickItem[] => ((pkg[k] ?? []) as AnyItem[]).map((it) => {
    const look = item_look(k, it, pkg.assets, cat);
    return { key: full_key(pkg.id, k, it.key), name: it.name || it.key, group: 'mod', picture: look.picture ?? undefined, chip: look.chip, set: (it as { set?: string }).set };
  });
  const own_names = new Map(KINDS.flatMap((k) => ((pkg[k] ?? []) as AnyItem[]).map((it) => [full_key(pkg.id, k, it.key), it.name || it.key] as const)));
  const name_of = (k: string) => own_names.get(k) ?? cat.name(k);
  const g = lab.game;
  const acts = g?.actions ?? [];
  const has = (type: string) => acts.some((a) => a.type === type);
  const play = acts.find((a) => a.type === 'play');

  if (!can_act) return <Notice>{L.sign_in} <a href={sign_in_url}>{t.app.sign_in}</a></Notice>;
  if (!g) {
    return (
      <div className="lab lab--idle">
        <div className="grid-3">
          <Field label={L.deck}>{(id) => (
            <Select<string> id={id} value={deck} onChange={setDeck} options={[
              ...(own_decks.length ? [{ group: pkg.name, options: own_decks }] : []),
              { group: t.sprites.game, options: (cat.catalog?.decks ?? [{ key: 'b_red', name: 'Red Deck' }] as { key: string; name: string }[]).map((d) => ({ value: d.key, label: cat.name(d.key) })) },
            ]} />
          )}</Field>
          <Field label={L.seed}>{(id) => <TextInput id={id} mono value={seed} maxLength={8} placeholder={L.seed_placeholder} onChange={(v) => setSeed(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />}</Field>
          <div className="lab__go">
            <Button tone="primary" size="lg" icon="play" busy={lab.busy} disabled={errors > 0} onClick={() => void lab.start(deck, seed)}>{lab.busy ? L.starting : L.start}</Button>
          </div>
        </div>
        {errors > 0 ? <Notice tone="warning">{t.test.server.local_first}</Notice> : null}
        {lab.error ? <LabError error={lab.error} /> : null}
      </div>
    );
  }
  const blind = g.blind;
  return (
    <div className="lab">
      {lab.stale ? (
        <Notice tone="warning">{L.stale} <button type="button" className="link" onClick={() => void lab.start(deck, seed)}>{L.restart}</button></Notice>
      ) : null}
      <div className="lab__hud">
        <span className="hud"><b>{L.phases[g.phase] ?? g.phase}</b>{blind ? <> · {blind.name}</> : null}</span>
        <span className="hud">{L.ante} <b>{g.ante}</b></span>
        <span className="hud">{L.round} <b>{g.round}</b></span>
        {blind && g.phase === 'playing' ? <span className="hud hud--score">{L.score} <b>{f.number(g.round_score ?? 0)}</b> / {f.number(blind.chips)}</span> : null}
        <span className="hud hud--hands">{L.hands} <b>{g.hands_left}</b></span>
        <span className="hud hud--discards">{L.discards} <b>{g.discards_left}</b></span>
        <span className="hud hud--money">{L.money} <b>${g.dollars}</b></span>
        <span className="hud">{L.deck_left(g.deck.remaining, g.deck.total)}</span>
        <span className="lab__grow" />
        <Button size="sm" tone="ghost" icon="refresh" onClick={() => void lab.start(deck, seed)} busy={lab.busy}>{L.restart}</Button>
        <Button size="sm" tone="ghost" icon="x" onClick={() => void lab.end()}>{L.end}</Button>
      </div>

      <div className="lab__tools" role="toolbar" aria-label={L.add}>
        <span className="lab__label">{L.add}</span>
        <KeyPicker label={L.add_joker} value={undefined} kinds={['jokers']} extra={own('jokers')} placeholder={`+ ${L.add_joker}`} compact
          onChange={(k) => { if (k) void lab.creative({ op: 'add', key: k }, `${L.add_joker}: ${name_of(k)}`); }} />
        <KeyPicker label={L.add_consumable} value={undefined} kinds={['tarots', 'planets', 'spectrals']} extra={own('consumables')} placeholder={`+ ${L.add_consumable}`} compact
          onChange={(k) => { if (k) void lab.creative({ op: 'add', key: k }, `${L.add_consumable}: ${name_of(k)}`); }} />
        <KeyPicker label={L.add_voucher} value={undefined} kinds={['vouchers']} extra={own('vouchers')} placeholder={`+ ${L.add_voucher}`} compact
          onChange={(k) => { if (k) void lab.creative({ op: 'add', key: k }, `${L.add_voucher}: ${name_of(k)}`); }} />
        <KeyPicker label={L.add_tag} value={undefined} kinds={['tags']} placeholder={`+ ${L.add_tag}`} compact
          onChange={(k) => { if (k) void lab.creative({ op: 'add', key: k }, `${L.add_tag}: ${cat.name(k)}`); }} />
        <AddCard lab={lab} />
        <SetValue lab={lab} />
        {g.phase === 'playing' ? <Button size="sm" tone="success" icon="check" onClick={() => void lab.creative({ op: 'win' }, L.win)}>{L.win}</Button> : null}
      </div>

      {lab.error ? <LabError error={lab.error} /> : null}

      <div className="lab__main">
        <div className="lab__board">
          <section className="row">
            <h3 className="row__title">{L.jokers} <span className="muted">{g.jokers.length}/{g.joker_slots}</span></h3>
            <div className="row__cards">
              {g.jokers.map((c) => (
                <div key={c.id} className="tile-wrap">
                  <Tile card={c} extra={<Values ability={c.ability} />} />
                  <CardMenu card={c} lab={lab} actions={acts} area="jokers" />
                </div>
              ))}
            </div>
          </section>
          <section className="row row--small">
            <h3 className="row__title">{L.consumables} <span className="muted">{g.consumables.length}/{g.consumable_slots}</span></h3>
            <div className="row__cards">
              {g.consumables.map((c) => (
                <div key={c.id} className="tile-wrap">
                  <Tile card={c} scale={0.75} />
                  <CardMenu card={c} lab={lab} actions={acts} area="consumables" />
                </div>
              ))}
            </div>
          </section>

          {g.phase === 'blind_select' && g.blind_select ? (
            <section className="phase">
              <div className="blinds">
                {g.blind_select.choices.map((b) => (
                  <div key={b.slot} className={`blind-choice ${b.state === 'Select' ? 'is-on' : ''}`}>
                    <b>{b.name}</b>
                    <span className="muted small">{f.number(b.chips)} · ${b.reward}</span>
                    {b.state === 'Select' ? (
                      <span className="blind-choice__acts">
                        <Button size="sm" tone="primary" onClick={() => void lab.act({ type: 'select_blind' }, `${L.select_blind}: ${b.name}`)}>{L.select_blind}</Button>
                        {has('skip_blind') ? <Button size="sm" tone="ghost" onClick={() => void lab.act({ type: 'skip_blind' }, `${L.skip_blind}: ${b.name}`)}>{L.skip_blind}</Button> : null}
                      </span>
                    ) : <Badge>{b.state}</Badge>}
                  </div>
                ))}
              </div>
              <KeyPicker label={L.boss_pick} value={undefined} kinds={['blinds']} extra={own('blinds')} placeholder={L.boss_pick} compact
                onChange={(k) => { if (k) void lab.creative({ op: 'boss', key: k }, `${L.boss}: ${name_of(k)}`); }} />
            </section>
          ) : null}

          {g.phase === 'round_eval' && g.round_eval ? (
            <section className="phase">
              <ul className="eval">
                {g.round_eval.rows.map((r, i) => <li key={i}><span>{L.round_rows[r.kind] ?? r.kind}{r.key ? ` · ${name_of(r.key)}` : ''}</span><b>${r.dollars}</b></li>)}
              </ul>
              <Button tone="gold" onClick={() => void lab.act({ type: 'cash_out' }, L.cash_out(String(g.round_eval!.total)))}>{L.cash_out(String(g.round_eval.total))}</Button>
            </section>
          ) : null}

          {g.phase === 'shop' && g.shop ? (
            <section className="phase">
              <div className="row__cards">
                {[...g.shop.jokers, ...g.shop.vouchers, ...g.shop.boosters].map((c) => {
                  const buy = acts.find((a) => a.type === 'buy' && a.card === c.id);
                  return (
                    <div key={c.id} className="tile-wrap">
                      <Tile card={c} scale={0.75} />
                      <Button size="sm" disabled={!buy} onClick={() => void lab.act({ type: 'buy', card: c.id }, `${L.buy}: ${card_label(c)}`)}>{L.buy} ${c.cost ?? '?'}</Button>
                    </div>
                  );
                })}
              </div>
              <div className="mini-form__row">
                {has('reroll') ? <Button size="sm" onClick={() => void lab.act({ type: 'reroll' }, L.reroll(g.shop!.reroll_cost))}>{L.reroll(g.shop.reroll_cost)}</Button> : null}
                <Button size="sm" tone="primary" onClick={() => void lab.act({ type: 'end_shop' }, L.end_shop)}>{L.end_shop}</Button>
              </div>
            </section>
          ) : null}

          {g.phase === 'pack' && g.pack ? (
            <section className="phase">
              <div className="row__cards">
                {g.pack.cards.map((c) => (
                  <div key={c.id} className="tile-wrap">
                    <Tile card={c} scale={0.75} />
                    <Button size="sm" disabled={!acts.some((a) => a.type === 'pick' && a.card === c.id)}
                      onClick={() => void lab.act({ type: 'pick', card: c.id, targets: lab.selected.length ? lab.selected : null }, `${L.pick}: ${card_label(c)}`)}>{L.pick}</Button>
                  </div>
                ))}
              </div>
              <Button size="sm" tone="ghost" onClick={() => void lab.act({ type: 'skip_pack' }, L.skip_pack)}>{L.skip_pack}</Button>
            </section>
          ) : null}

          <section className="row row--hand">
            <h3 className="row__title">{L.hand} <span className="muted">{g.hand.length}/{g.hand_size}</span></h3>
            <div className="row__cards row__cards--hand">
              {g.hand.map((c) => (
                <div key={c.id} className="tile-wrap">
                  <Tile card={c} selected={lab.selected.includes(c.id)} onClick={() => lab.toggle(c.id)} />
                  <CardMenu card={c} lab={lab} actions={acts} area="hand" />
                </div>
              ))}
            </div>
            {g.phase === 'playing' ? (
              <div className="hand-bar">
                <span className="hand-bar__preview">
                  {lab.preview?.hand ? (lab.preview.not_allowed ? <span className="is-bad">{L.not_allowed}</span>
                    : L.preview(lab.preview.display_name ?? lab.preview.hand, lab.preview.level ?? 1, lab.preview.chips ?? 0, lab.preview.mult ?? 0)) : <span className="muted">{L.select_hint}</span>}
                </span>
                <Button size="sm" tone="ghost" onClick={() => void lab.act({ type: 'sort', mode: 'rank' }, L.sort_rank)}>{L.sort_rank}</Button>
                <Button size="sm" tone="ghost" onClick={() => void lab.act({ type: 'sort', mode: 'suit' }, L.sort_suit)}>{L.sort_suit}</Button>
                <Button tone="danger" disabled={!lab.selected.length || !has('discard')}
                  onClick={() => void lab.act({ type: 'discard', cards: lab.selected }, `${L.discard}: ${lab.selected.map((id) => card_label(g.hand.find((c) => c.id === id)!)).join(' ')}`)}>
                  {L.discard}
                </Button>
                <Button tone="primary" disabled={!lab.selected.length || !play}
                  onClick={() => void lab.act({ type: 'play', cards: lab.selected }, `${L.play}: ${lab.preview?.display_name ?? ''} ${lab.selected.map((id) => card_label(g.hand.find((c) => c.id === id)!)).join(' ')}`)}>
                  {L.play}
                </Button>
              </div>
            ) : null}
          </section>
        </div>
        <aside className="lab__log">
          <h3 className="row__title">{L.log}</h3>
          <Log log={lab.log} />
        </aside>
      </div>
    </div>
  );
}

function LabError({ error }: { error: unknown }) {
  const { describe } = useI18n();
  const errors = (error as { problem?: { errors?: unknown[] } })?.problem?.errors;
  return (
    <Notice tone="error">
      <p>{describe(error)}</p>
      {Array.isArray(errors) ? <ul className="server-check__errors">{errors.filter((x) => typeof x === 'string').slice(0, 8).map((x, i) => <li key={i}><code>{String(x)}</code></li>)}</ul> : null}
    </Notice>
  );
}

