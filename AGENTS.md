# AGENTS.md

Rules for anyone, human or agent, changing this repository. `README.md`
describes the editor; this file says how to work on it.

## What this project is

The mod editor of Balatro in the browser: players make content mods
(BalatroEngine's format 1: jokers, consumables, vouchers, decks, boss blinds,
house rules, creative mode, and their art), test them in the real engine and
publish them to the registry (BalatroWebAPI's `/mods`). It is its own front
end, served at `/editor/` on the site's one origin, next to the portal (`/`),
the game (`/play/`) and the casino (`/casino/`).

## Non-negotiable rules

1. **A mod is the engine's format, and only the engine plays it.** The editor
   writes packages exactly as BalatroEngine reads them (`docs/mods.md` there)
   and never decides how a mod plays: scores, chances and effects come from
   the engine (the API's runs: the scoring lab, the server's check). What the
   editor shows before (a description's values, a preview) is a preview on
   sample values.
2. **The checks are the engine's, word for word.** `src/shared/lib/mod/spec.ts`
   and `expr.ts` are twins of the engine's `balatro/mods/spec.py` and
   `expr.py` (and `expr.ts` of the game's `src/shared/lib/mod-expr`): keep them
   in step. `npm run parity` compares the validators on thousands of packages
   (it needs `../BalatroEngine/.venv`); it must report no difference. A new
   format field: engine first (with its tests), then here, then parity.
3. **A package's hash is the API's.** `hash.ts` computes BalatroWebAPI's
   `package_hash` (sha256 of the canonical JSON as Python writes it): the game's
   library and the registry name packages by it.
4. **The game's library is the game's.** `src/shared/api/library.ts` is the
   twin of BalatroFrontEnd's `src/entities/mod/model/library.ts` (IndexedDB
   `balatro-fe.mods`): change the two together. The editor's own projects live
   apart (`balatro-editor`).
5. **One origin, one session, one language.** `src/shared/api/session.ts` is the
   same file as the portal's, the game's and the casino's; `src/shared/i18n/
   language.ts` the same as the portal's and the casino's: change them together.
   Every text the player reads is in `shared/i18n/messages` (English first;
   Russian has every key: TypeScript checks it), problems included
   (`problems-ru.ts`; the English is the engine's own words).
6. **The game's art and font are the game's.** Sprites and the m6x11plus font
   are loaded from the game (`/play/resources/...`) at run time; never copy them
   into this repository.
7. **Test runs are cleaned up.** The scoring lab deletes its run when it ends
   or restarts; runs with mods never count for statistics (the API's rule 9).

## Architecture (Feature-Sliced Design)

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
```

A layer imports only the layers to its right; slices of one layer don't
import each other; every slice exposes its public API in `index.ts`.
`npm run lint` (Steiger) enforces it. A slice exists once two places use it.

- `shared/lib/mod`: the format (expressions, checks, markup, templates,
  refactorings, sample values, hashes, paths). No React; runs in Node too
  (`.ts` imports: the tests and the parity script import it directly).
- `shared/ui`: the controls, the game's look (sprites, card art, game text) and
  the two editors every form uses (`ExpressionInput`, `MarkupInput`).
- `entities/project`: a mod being made (IndexedDB), its changes (undo/redo,
  typing grouped), autosave, its problems; `entities/catalog`: the game's cards
  (API catalog + the game's texts); `entities/registry`: the mod's id in the
  registry; `entities/session`: who is signed in.
- `widgets/workspace` (the editor around a mod), `widgets/card-preview` (an
  item as the game shows it), `widgets/art-studio` (the pixel editor).
- `pages/*`: home, overview, items (all five kinds), art, translations,
  package, test (server check, install in the game, scoring lab), publish,
  reference.

## Conventions

- TypeScript strict, erasable syntax only (Node strips the types of
  `shared/lib/mod` in the tests). Functions and variables in snake_case, like
  the game and the portal, except React components and hooks.
- Every field of a form carries its package path (`Field path=`): a problem's
  link scrolls to it (`focus_path`).
- Styles in `src/app/styles/`, one file per concern, `tokens.css` first,
  `motion.css` last; respect `prefers-reduced-motion`.
- Fonts are self-hosted (Fontsource): no request to a third-party service.

## Commands

```
npm install
npm run dev         # (make run) :5176/editor/, the services on their dev ports
npm run check       # (make check) typecheck + Steiger + tests
npm run parity      # (make parity) the validator against the engine's
npm run build
```

All checks must pass before committing.
