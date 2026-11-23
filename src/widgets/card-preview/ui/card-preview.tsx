// A mod's item as the game shows it: the card (tilting under the pointer, as
// the game's cards do), and its popup: the name, the description in the
// game's markup with its values filled in (on a sample run), and the badge.
// A deck shows its back and description; a boss blind its chip, name,
// description, size and reward.
import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { useCatalog, item_look } from '@/entities/catalog';
import { useI18n } from '@/shared/i18n';
import { description_vars, type ItemKind, type ModPackage } from '@/shared/lib/mod';
import { BlindChip, CardArt, GameText, use_game_font } from '@/shared/ui';

const RARITY = ['#009dff', '#4bc292', '#fe5f55', '#b26cbb'];
const SET_COLOUR: Record<string, string> = { Tarot: '#a782d1', Planet: '#13afce', Spectral: '#4584fa', Voucher: '#fd682b' };

/** an item's name and text in a language (its `loc`), English when it has none */
export function texts_in(item: any, lang: string): { name: string; text: string[] } {
  const loc = item?.loc ?? {};
  const t = lang === 'en-us' ? null : loc[lang] ?? loc[lang.split(/[-_]/)[0]] ?? null;
  return { name: t?.name ?? item?.name ?? '', text: t?.text ?? item?.text ?? [] };
}

function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 16).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
  };
  const leave = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  return <div ref={ref} className={['tilt', className ?? ''].filter(Boolean).join(' ')} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}

export function CardPreview({ kind, item, pkg, lang = 'en-us', scale = 2 }: {
  kind: ItemKind; item: any; pkg: ModPackage; lang?: string; scale?: number;
}) {
  const { t } = useI18n();
  const cat = useCatalog();
  const font = use_game_font();
  const look = item_look(kind, item, pkg.assets, cat);
  const { name, text } = texts_in(item, lang);
  const vars = description_vars(item?.vars, item?.config);
  const tooltip = (key: string) => cat.name(key);
  const style = { '--card-scale': scale } as CSSProperties;

  if (kind === 'blinds') {
    const dollars = typeof item?.dollars === 'number' ? item.dollars : 5;
    const mult = typeof item?.mult === 'number' ? item.mult : 2;
    const lo = typeof item?.min_ante === 'number' ? item.min_ante : 1;
    const hi = typeof item?.max_ante === 'number' ? item.max_ante : 10;
    return (
      <div className={['preview', 'preview--blind', font ? 'has-font' : ''].join(' ')} style={{ ...style, '--blind': look.chip?.colour ?? '#b44430' } as CSSProperties}>
        <div className="preview-blind">
          <p className="preview-blind__label">{item?.showdown ? t.preview.final_boss : t.preview.boss}</p>
          <div className="preview-blind__chip">
            <BlindChip y={look.chip?.y ?? 7} colour={look.chip?.colour} scale={2.6} />
          </div>
          <p className="preview-blind__name">{name || '—'}</p>
          <div className="preview-blind__text">
            {text.some((l) => l.trim()) ? <GameText lines={text} vars={vars} light tooltip={tooltip} /> : <span className="preview__none">{t.preview.no_text}</span>}
          </div>
          <div className="preview-blind__facts">
            <span className="preview-blind__size">{t.preview.size(String(mult))}</span>
            <span className="preview-blind__reward">{t.preview.reward}: <b>{'$'.repeat(Math.min(dollars, 12)) || '—'}</b></span>
            <span className="preview-blind__antes">{t.preview.antes(lo, hi)}</span>
          </div>
        </div>
      </div>
    );
  }

  let badge: { text: string; colour: string } | null = null;
  if (kind === 'jokers') {
    const r = Math.min(4, Math.max(1, Number(item?.rarity) || 1));
    badge = { text: t.preview.rarities[r - 1], colour: RARITY[r - 1] };
  } else if (kind === 'consumables') {
    const set = String(item?.set ?? 'Tarot');
    badge = { text: t.preview.badges[set] ?? set, colour: SET_COLOUR[set] ?? '#a782d1' };
  } else if (kind === 'vouchers') {
    badge = { text: t.preview.badges.Voucher, colour: SET_COLOUR.Voucher };
  }

  return (
    <div className={['preview', `preview--${kind}`, font ? 'has-font' : ''].join(' ')} style={style}>
      <Tilt className={kind === 'decks' ? 'tilt--deck' : undefined}>
        {kind === 'decks' ? <span className="deck-stack" aria-hidden><CardArt picture={look.picture} scale={scale} /><CardArt picture={look.picture} scale={scale} /></span> : null}
        <CardArt picture={look.picture} scale={scale} className={look.fallback ? 'is-default' : undefined} title={name} />
      </Tilt>
      <div className="popup" role="group" aria-label={name}>
        <div className="popup__inner">
          <p className="popup__name">{name || '—'}</p>
          <div className="popup__desc">
            {text.some((l) => l.trim()) || (kind === 'consumables' && item?.set === 'Planet')
              ? <GameText lines={text.length ? text : []} vars={vars} tooltip={tooltip} />
              : <span className="preview__none">{t.preview.no_text}</span>}
          </div>
          {badge ? <span className="popup__badge" style={{ background: badge.colour }}>{badge.text}</span> : kind === 'decks' ? <span className="popup__badge popup__badge--deck">{t.preview.deck}</span> : null}
        </div>
      </div>
    </div>
  );
}
