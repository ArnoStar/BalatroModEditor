# Balatro Mod Editor

The site's editor for content mods: make jokers, consumables, vouchers, decks,
boss blinds and house rules, draw their art, test them in the real engine and
publish them for every player. Served at `/editor/`, next to the portal (`/`),
the game (`/play/`) and the casino (`/casino/`).

A mod is data, never code (BalatroEngine's content mod format, `docs/mods.md`
in BalatroEngine): effects are a trigger, a condition and actions; conditions
and amounts are expressions in a small safe language. The editor writes exactly
that format, checks it with the engine's own rules as you type, and lets the
engine play it.

## What it does

- **Mods in your browser**: start empty, from a template (a few jokers, one of
  everything, house rules, a creative sandbox) or from an official example;
  import a `.json` file (or drop it), a mod installed in the game, or the latest
  version of one you published. Everything is saved as you type; export a file
  to keep a copy.
- **Every item of the format**, each with its form and a live preview drawn as
  the game draws it (its art, its font, its description with the values filled
  in on a sample run):
  - jokers: rarity, price, shop and sticker flags, values (`config`), effects
    (when / if / do / else, with every trigger and action), changes while in play;
  - consumables: Tarot, Planet (a poker hand, or its own use) or Spectral, cards
    to select, a condition to be used, its use;
  - vouchers (and the vouchers they need first), decks (start, starting jokers,
    consumables and vouchers, the deck's cards), boss blinds (size, reward,
    antes, final boss, colour, chip, debuffs, what happens when set and each hand);
  - the mod: id, version, author, description, tags, house rules, creative mode.
- **Expressions** with highlighting, completions for what may be named there
  (and the values a string can take: suits, hands, the game's keys …), the
  engine's errors where they are, and the value on a sample.
- **Text** in the game's markup with a toolbar (colours, boxes, sizes, values,
  tooltips) and each part shown in its colour.
- **Art**: the game's sprite sheets to pick from, uploads made one card, and a
  pixel studio (71 × 95 doubled, or 142 × 190): layers, pencil, eraser, fill,
  lines, shapes, mirror, the game's colours, tracing over a game card.
- **Translations** in the game's 15 languages, side by side with the English.
- **Problems**: the engine's checks (word for word: the validator is a twin of
  the engine's, compared by `npm run parity`), the keys the engine looks up, and
  advice; each one opens its field.
- **Test**: the server's check (the engine plays a short run with the mod), one
  click to install it in the game (with Creative mode), and the **scoring lab**:
  a real run with the mod and Creative mode, where you put any card in play,
  play hands and see what each card and joker scored, in the game's order.
- **Publish** to the registry (the id becomes yours; versions only go up),
  see versions and installs, unlist.
- **Reference**: the whole format, the game's keys (searchable, with their
  pictures), and an expression playground.

English and Russian (the site's language, shared with the portal, the casino
and the game).

## Running it

```
npm install
npm run dev            # http://localhost:5176/editor/
```

The dev server passes `/api` (BalatroWebAPI on :8000), `/identity` (:8001) and
`/play` (the game's dev server on :5173: its sprites, font and texts, and the
game itself) on. The game opened from the editor (`/play/` on the same origin)
shares its library, so a mod installed from the editor is in its MODS menu.
With the API's sign-in off (`BALATRO_API_DATABASE_URL=memory`), everything works
without an account. `make dev` in BalatroFrontEnd runs the whole site
(http://localhost:5174/editor/).

## Checks

```
npm run check          # typecheck, Steiger (Feature-Sliced Design), tests
npm run parity         # the validator against BalatroEngine's (needs ../BalatroEngine/.venv)
```

## Deployment

The Dockerfile builds the app and serves it with nginx under `/editor/`.
BalatroFrontEnd's `docker-compose.yml` runs it as the `editor` service and the
portal's nginx passes `/editor/` to it (`EDITOR_UPSTREAM`). The CI/CD workflow
checks every push; on `main` it copies the repository to the server and
restarts the `editor` service (`.github/deploy.sh`), once the `DEPLOY_*`
secrets are set in the `production` environment (as for the other repos).
