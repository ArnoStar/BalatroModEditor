// An item's picture: a cell of the game's art, one of the mod's images, a new
// drawing, or an uploaded image (made one card of 142 x 190). Decks take only
// the game's deck backs; boss blinds one of the game's chips.
import { useMemo, useState } from 'react';
import { ItemPicture, item_look, useCatalog, use_pick_items } from '@/entities/catalog';
import { use_field_issues, useProject } from '@/entities/project';
import { ArtStudio } from '@/widgets/art-studio';
import { useI18n } from '@/shared/i18n';
import { data_url_bytes, file_url, fit_card, pick_files, slug, unique } from '@/shared/lib';
import { ATLASES as SPEC_ATLASES, MAX_ASSET_BYTES, rename_asset, type ItemKind } from '@/shared/lib/mod';
import { BlindChip, Button, CardArt, Field, Modal, Notice, Segmented, Sprite } from '@/shared/ui';
import { use_item } from '../model/item';

type Tab = 'game' | 'yours' | 'draw' | 'upload';

const SHEETS: Record<ItemKind, string[]> = {
  jokers: ['Joker'], consumables: ['Tarot', 'Planet', 'Spectral'], vouchers: ['Voucher'], decks: ['centers'], blinds: [],
};

export function PictureSection({ kind, index }: { kind: ItemKind; index: number }) {
  const { t } = useI18n();
  const cat = useCatalog();
  const { pkg, change_all, project } = useProject();
  const { item, ps, put } = use_item(kind, index);
  const errors = use_field_issues(ps('sprite'), true);
  const [open, setOpen] = useState(false);
  const look = item_look(kind, item, pkg.assets, cat);
  const s = item?.sprite;

  const add_image = (png: string, name: string, source?: unknown, replaces?: string | null) => {
    change_all(({ pkg: p0, art: art0 }) => {
      // (a drawing saved under a new name: the old image is renamed, for every item that shows it)
      const p = replaces && replaces !== name ? rename_asset(p0, replaces, name) : p0;
      const art = { ...art0 };
      if (replaces && replaces !== name) delete art[replaces];
      const assets = { ...(p.assets ?? {}), [name]: png };
      const list = ((p[kind] ?? []) as any[]).slice();
      list[index] = { ...list[index], sprite: name };
      return { pkg: { ...p, assets, [kind]: list }, art: source ? { ...art, [name]: source as never } : art };
    });
  };

  if (kind === 'blinds') {
    return (
      <div className="picture picture--blind" data-path={ps('sprite')}>
        <BlindChip y={look.chip?.y ?? 7} colour={look.chip?.colour} scale={2} />
        <div className="picture__side">
          <Field label={t.sprites.title} help={t.sprites.blind_note} errors={errors}>
            {(id) => <BlindChips id={id} value={s && typeof s === 'object' && 'blind' in s ? String(s.blind) : undefined} onChange={(b) => put('sprite', b ? { blind: b } : undefined)} />}
          </Field>
        </div>
      </div>
    );
  }

  const where = typeof s === 'string' ? t.sprites.yours : s && typeof s === 'object' ? `${t.sprites.sheets[String(s.atlas)] ?? s.atlas} · ${t.sprites.cell(Number(s.x), Number(s.y))}` : t.sprites.none;
  return (
    <div className="picture" data-path={ps('sprite')}>
      <button type="button" className="picture__card" onClick={() => setOpen(true)} aria-label={t.sprites.title}>
        <CardArt picture={look.picture} scale={1.5} className={look.fallback ? 'is-default' : undefined} />
      </button>
      <div className="picture__side">
        <p className="picture__where">{where}</p>
        {errors.map((e, i) => <p key={i} className={`field__problem field__problem--${e.level}`}>{e.text}</p>)}
        {kind === 'decks' ? <p className="muted small">{t.sprites.deck_note}</p> : null}
        <div className="picture__buttons">
          <Button size="sm" icon="image" onClick={() => setOpen(true)}>{t.sprites.title}</Button>
          {typeof s === 'string' ? (
            <Button size="sm" tone="ghost" icon="pencil" onClick={() => setOpen(true)}>{t.sprites.edit_drawing}</Button>
          ) : null}
          {s !== undefined ? <Button size="sm" tone="ghost" icon="x" onClick={() => put('sprite', undefined)}>{t.sprites.none}</Button> : null}
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t.sprites.title} size="xl">
        <PickerBody kind={kind} value={s} onPick={(v) => { put('sprite', v); setOpen(false); }}
          onImage={(png, name, source, replaces) => { add_image(png, name, source, replaces); setOpen(false); }}
          item_key={String(item?.key ?? kind)} assets={pkg.assets ?? {}} art={project.art} />
      </Modal>
    </div>
  );
}

function BlindChips({ id, value, onChange }: { id: string; value: string | undefined; onChange: (b: string | undefined) => void }) {
  const cat = useCatalog();
  const blinds = cat.catalog?.blinds ?? [];
  return (
    <div className="chips-grid" id={id} role="listbox">
      {blinds.map((b) => (
        <button key={b.key} type="button" role="option" aria-selected={value === b.key} className={value === b.key ? 'is-on' : ''}
          title={`${cat.name(b.key)} — ${b.key}`} onClick={() => onChange(b.key)}>
          <BlindChip y={b.sprite?.pos.y ?? 0} colour={b.colour ?? undefined} scale={1.1} />
        </button>
      ))}
    </div>
  );
}

function PickerBody({ kind, value, onPick, onImage, item_key, assets, art }: {
  kind: ItemKind; value: unknown; onPick: (v: unknown) => void; onImage: (png: string, name: string, source?: unknown, replaces?: string | null) => void;
  item_key: string; assets: Record<string, string>; art: Record<string, unknown>;
}) {
  const { t } = useI18n();
  const cat = useCatalog();
  const sheets = SHEETS[kind];
  const editing = typeof value === 'string' && assets[value] ? value : null;
  const [tab, setTab] = useState<Tab>(editing ? 'draw' : typeof value === 'string' ? 'yours' : 'game');
  const [sheet, setSheet] = useState(() => (value && typeof value === 'object' && 'atlas' in value ? String((value as { atlas: string }).atlas) : sheets[0]));
  const [mode, setMode] = useState<'pixel' | 'smooth'>('pixel');
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<string | null>(editing);
  const trace = use_pick_items(['jokers', 'tarots', 'planets', 'spectrals', 'vouchers']);
  // which game card each cell is (its name on hover)
  const names = useMemo(() => {
    const m = new Map<string, string>();
    const all = [...(cat.catalog?.jokers ?? []), ...(cat.catalog?.tarots ?? []), ...(cat.catalog?.planets ?? []), ...(cat.catalog?.spectrals ?? []),
      ...(cat.catalog?.vouchers ?? []), ...(cat.catalog?.decks ?? []), ...(cat.catalog?.enhancements ?? [])];
    for (const x of all) if (x.sprite) m.set(`${x.sprite.atlas}:${x.sprite.pos.x}:${x.sprite.pos.y}`, cat.name(x.key));
    return m;
  }, [cat]);
  const new_name = unique(slug(item_key, 40, 'image'), Object.keys(assets), 48);

  const upload = async () => {
    setError(null);
    const [file] = await pick_files('image/*');
    if (!file) return;
    try {
      const png = await fit_card(await file_url(file), mode);
      if (data_url_bytes(png) > MAX_ASSET_BYTES) { setError(t.sprites.too_big); return; }
      onImage(png, unique(slug(file.name.replace(/\.[a-z0-9]+$/i, ''), 40, 'image'), Object.keys(assets), 48));
    } catch {
      setError(t.sprites.upload_failed);
    }
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: 'game', label: t.sprites.game },
    ...(kind !== 'decks' ? [{ value: 'yours' as Tab, label: t.sprites.yours }, { value: 'draw' as Tab, label: t.sprites.draw }, { value: 'upload' as Tab, label: t.sprites.upload }] : []),
  ];
  const a = SPEC_ATLASES[sheet] ?? [10, 6];
  const current = value && typeof value === 'object' && 'atlas' in value ? (value as { atlas: string; x: number; y: number }) : null;
  return (
    <div className="pick">
      <Segmented label={t.sprites.title} value={tab} onChange={(v) => { setTab(v); if (v === 'draw' && !editing) setDrawing(null); }} options={tabs} />
      {tab === 'game' ? (
        <>
          {sheets.length > 1 ? <Segmented size="sm" label={t.sprites.game} value={sheet} onChange={setSheet} options={sheets.map((x) => ({ value: x, label: t.sprites.sheets[x] ?? x }))} /> : null}
          {kind === 'decks' ? <Notice>{t.sprites.deck_note}</Notice> : null}
          <div className="sheet" style={{ gridTemplateColumns: `repeat(${a[0]}, 71px)` }}>
            {Array.from({ length: a[0] * a[1] }, (_, i) => {
              const x = i % a[0];
              const y = Math.floor(i / a[0]);
              const on = current && current.atlas === sheet && current.x === x && current.y === y;
              const name = names.get(`${sheet}:${x}:${y}`);
              return (
                <button key={i} type="button" className={on ? 'is-on' : ''} title={name ?? t.sprites.cell(x, y)} aria-label={name ?? t.sprites.cell(x, y)}
                  onClick={() => onPick({ atlas: sheet, x, y })}>
                  <Sprite atlas={sheet} x={x} y={y} scale={1} />
                </button>
              );
            })}
          </div>
        </>
      ) : tab === 'yours' ? (
        Object.keys(assets).length ? (
          <div className="assets-grid">
            {Object.entries(assets).map(([name, url]) => (
              <button key={name} type="button" className={value === name ? 'is-on' : ''} onClick={() => onPick(name)}>
                <CardArt picture={{ image: url }} scale={1} />
                <code>{name}</code>
              </button>
            ))}
          </div>
        ) : <p className="muted">{t.sprites.no_images}</p>
      ) : tab === 'draw' ? (
        <ArtStudio key={drawing ?? 'new'} name={drawing ?? new_name} image={drawing ? assets[drawing] : undefined}
          source={drawing ? (art[drawing] as never) : undefined} taken={Object.keys(assets).filter((n) => n !== drawing)}
          trace_items={trace} onSave={(r) => onImage(r.png, r.name, r.source, drawing)} />
      ) : (
        <div className="upload">
          <Field label={t.sprites.upload_mode}>
            {() => <Segmented label={t.sprites.upload_mode} value={mode} onChange={setMode} options={[{ value: 'pixel', label: t.sprites.pixel }, { value: 'smooth', label: t.sprites.smooth }]} />}
          </Field>
          <Button tone="primary" icon="upload" onClick={() => void upload()}>{t.sprites.upload}</Button>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      )}
      <div className="pick__now">
        <span className="muted small">{t.sprites.current}</span>
        <ItemPicture item={{ picture: item_look(kind, { sprite: value }, assets, cat).picture ?? undefined }} scale={0.6} />
      </div>
    </div>
  );
}
