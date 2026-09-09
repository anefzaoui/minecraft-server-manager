# CLAUDE.md

Guidance for Claude Code working in this repo. For the full picture read
[`docs/architecture.md`](docs/architecture.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md);
this file is the short version plus the things that will trip you up.

## What this is

Minecraft Server Manager is a **single-process, server-rendered Node.js control panel** for
Minecraft servers that run as Docker containers (the `itzg/docker-minecraft-server` image). It
talks to the Docker daemon over its API via **dockerode** — never by shelling out to the `docker`
CLI. All persistent state lives under one directory (`$DATA_DIR`, default `./data`): the SQLite DB,
per-server world data, backups, the mod library. Copying that directory migrates the whole panel.

Requires **Node.js 24+** (for the flagless built-in `node:sqlite`). Package manager is **pnpm**.

## Commands

```bash
pnpm install
pnpm run dev            # app with --watch auto-restart + Tailwind CSS watch; serves raw public/js
pnpm start              # production entry (src/server.js)

# CI gates — all five must pass before a PR (run on a clean clone, no Docker/app needed):
pnpm run lint           # ESLint — errors only, no warnings tolerated
pnpm run format:check   # Prettier   (pnpm run format to fix)
pnpm run typecheck      # tsc --checkJs over the type-clean core
pnpm test               # node:test unit suite, fast, no Docker
pnpm run build          # Tailwind CSS + esbuild client-JS bundle

pnpm run test:watch     # re-run unit suite on save while iterating
pnpm run test:smoke     # scripts/qa-sweep.js — live sweep against a RUNNING panel (needs QA_USER/QA_PASS)
node --test test/foo.test.js   # run one test file
pnpm run db:migrate     # apply src/db/migrations/* by hand
```

`main` is protected; every change lands through a PR whose `quality` check runs all five gates.

## Architecture — layering flows one direction only

```
web/routes/  (HTTP: parse + zod-validate input, shape responses — NO business logic)
     ↓
services/    (domain logic — the actual features; may call each other + infra)
     ↓
docker/  ·  db/  ·  storage/     (infrastructure)
```

- **`src/web/routes/`** — one Express router per domain (`servers`, `players`, `worlds`, `crashes`,
  `blueprints`, `files`, …), mounted in [`src/web/app.js`](src/web/app.js). Two routers mount in the
  **public zone** before `requireAuth`: `routes/status.js` (opt-in per-server HTML status pages) and
  `routes/apiV1.js` (`/api/v1`, read-only JSON, Bearer-token auth, off by default).
- **`src/services/`** — the heart of the app; each service owns one domain.
- **`src/docker/`** — dockerode wrappers: `connect` (endpoint auto-detected per-OS), `containers`,
  `logs`, `stats`, `images`, and `watcher` (turns Docker events into history + crash detection).
- **`src/db/`** — [`src/db/index.js`](src/db/index.js) is the **only** module that touches the
  driver (`node:sqlite`, synchronous, WAL, prepared-statement cache keyed on SQL text). API:
  `run / get / all / exec / transaction(fn) / backupTo`. Schema changes = a new numbered file in
  `src/db/migrations/`, applied on boot.
- **`src/storage/`** — the `./data` bootstrap, the **path guard** (`safeJoin`), and the background
  size-indexer + disk-quota enforcement.

Cross-cutting: **`src/config/`** (env config + the field catalog, below); **`src/events/`**
(`recordEvent()` is the one entry point for the history log); **`src/ws/`** (authenticated,
per-server **brokered** console + stats WebSockets — one upstream `docker logs --follow` per server
fanned out to every tab); **`src/logger.js`** + **`src/instrument.js`** (Pino + a dormant Sentry seam).

Boot sequence, key domain behaviors (modpacks are always pinned, the custom-mod overlay, port
allocation, disk quotas, at-rest secret encryption), and wire formats are all detailed in
[`docs/architecture.md`](docs/architecture.md).

## Conventions that will surprise you

1. **Never touch the filesystem under `./data` directly.** Resolve every path through the path guard
   in `src/storage/` (`safeJoin` / `dataPath`). It rejects anything escaping the data root — this is
   the backbone of the file-safety story. Uploads and archive extraction are additionally size-capped.
2. **Mid-function `require()` calls are intentional cycle-breakers.** If you see
   `const x = require('...')` inside a function body, it's avoiding a circular dependency at load
   time. Don't hoist it to the top without checking for the cycle.
3. **The field catalog is the single source of truth for server settings.**
   [`src/config/field-catalog/`](src/config/field-catalog/) catalogs every itzg env var / Docker
   limit / `server.properties` key with its label, help, type, default, validation, section, and
   danger flags. The wizard, settings forms, and zod validation all derive from it — exposing a new
   setting is a data change, not new UI plumbing.
4. **Server code is plain CommonJS JS — no TypeScript compile step.** Type safety is JSDoc + a
   `tsc --checkJs` gate. `types/globals.d.ts` holds ambient augmentations; dynamic-interop files
   (Docker/NBT/HTTP-JSON) carry a `// @ts-nocheck` header while typing is grown incrementally. New
   modules are checked by default — keep them clean.
5. **Browser JS (`public/js/`) is hand-written ESM progressive enhancement** — no framework, no SPA.
   esbuild bundles it to `public/dist/js/` for production; the app serves that when present and raw
   source otherwise, so a dev run without a build still works. `public/vendor/chart.umd.js` is a
   **vendored** Chart.js copy, not a dependency — update by hand, note the version in the PR.

## Shared helpers — prefer these over re-implementing

- `src/utils/httpError.js` — `httpError(status, message)` for throwing HTTP errors from services.
- `src/web/middleware/asyncHandler.js` — wraps async route handlers so rejections reach the error
  handler; prefer it over hand-written `try/catch → next(err)`.
- `src/web/middleware/jsonErrorHandler.js` — the standard JSON error handler (redacts 5xx detail).

## Logging (ESLint enforces `no-console` under `src/**`)

```js
const logger = require('../logger')(require('node:path').basename(__filename));
```

- **Message string:** one plain sentence, sentence case, ends in `.`/`!`/`?`, **no colon**. Every
  variable goes in the structured second arg, never interpolated:
  `logger.info('Started a server.', { serverId, actor })`.
- **Levels:** `info` = start/finish of a state change; `debug` = rejected input / early returns /
  hot read paths; `warn` = recoverable failure; `error` = failure with a stack (pair with
  `captureError(err, …)`); `fatal` = process going down.
- **One owner per error:** a `catch` that rethrows or calls `next(err)` does not log. A `catch` that
  swallows and handles locally logs exactly once.
- High-frequency background loops use `makeFailureThrottle()` from `src/logger.js` (one line on a
  persistent failure, plus a "recovered" line), not a log per tick.
- Never hand the logger request bodies, passwords, tokens, or full entity lists — ids and counts
  only. `src/utils/logSanitize.js` redacts secret-shaped keys but don't rely on it.

## Styling & UI (Tailwind v4, server-rendered Handlebars)

CSS source is [`assets/css/input.css`](assets/css/input.css) (`pnpm run build:css` / `watch:css`
→ `public/css/app.css`). It has three commitments — a cool "stone" neutral ramp with grass green as
the single accent, IBM Plex Sans body + Press Start 2P for titles, and cards on a fixed
sidebar+topbar shell. Match the existing register: blocky (`rounded-sm`), tactile (buttons
physically press on `:active`).

**Mobile-first — design the narrow layout first, then add breakpoint prefixes to widen it.**

- Bare utilities are the phone layout; `sm:` / `md:` / `lg:` / `xl:` only _add_ to it. Never write a
  desktop layout that `max-*:` / `sm:hidden` peels back.
- Every data table is a `.table-base` and gets `.table-stack` so rows collapse into "Label: value"
  cards below `sm` (label from each `<td data-th="…">`). Keep the `overflow-x-auto` wrapper for the
  wide table.
- Rigid grids and toolbars must collapse on narrow screens (see "Pass 5/6" commits); the
  world-controls rail collapses below `xl`.
- **Touch-target floor:** icon-only `.btn-sm` / `.chip` get a real `min-height`/`min-width` of
  `2.75rem` under `@media (pointer: coarse)`. Hover-only affordances go behind
  `@media (hover: hover)`.

**Consistent styling — reuse the primitives; do not invent one-off colorways.**

- **Semantic tokens only.** Components reference `surface` / `raised` / `inset` / `ink` /
  `ink-soft` / `line` / `ok` / `warn` / `danger` / `link` — never raw palette values
  (`grass-500`, `stone-700`) at call sites. Dark is the default theme; light is opt-in via
  `<html data-theme="light">`, and only semantic tokens swap.
- **Fixed component classes** (in `@layer components`): `.btn` + `.btn-primary` / `.btn-danger` /
  `.btn-ghost` / `.btn-sm`; `.card`; `.badge` + `.badge-ok/-warn/-danger/-info` (the _only_ badge
  colorways); `.chip`; `.notice` + `.notice-ok/-warn/-danger/-info` (the one inline callout — no
  ad-hoc border/background pairs). Shared view partials: `page-header`, `brand-lockup`,
  `empty-state`, `settings/card`, `settings/toggle-row`.
- **One z-index scale**, listed in `input.css`: topbar 20 · sidebar backdrop 30 · sidebar 40 ·
  modal 60 · toasts 65 · dropdowns 68 · tooltip 70. Anything new picks a slot there.
- **Write Tailwind classes as full literals** — the v4 scanner only emits utilities it sees
  verbatim. No `bg-${color}-500` assembly (that's why `STATUS_DOT` in `web/app.js` is a literal map).
- Respect `@media (prefers-reduced-motion: reduce)` — it's already handled globally; don't fight it.

## User-facing copy

Everything a person reads in the panel — button labels, headings, help text, empty states, toasts,
validation and error messages, and the docs — follows one house style (full detail in
[`CONTRIBUTING.md`](CONTRIBUTING.md#user-facing-copy)).

### Title Case vs. sentence case

- **Title Case:** buttons; short selectable choices (dropdown options, radio/checkbox labels, tabs,
  overflow-menu items, toggle chips); `<h2>` / `<h3>` section and card headings; table `<th>`;
  non-progress `openModal` titles.
- **ALL CAPS:** only `page-header heading=`.
- **Sentence case (a full sentence):** everything else — help, hints, tooltips, placeholders,
  empty-state bodies, toasts, confirm-dialog bodies _and_ titles, event and history summaries.
- Proper nouns stay capitalised in any casing: Minecraft, Mojang, Docker, Java, RCON, Modrinth,
  CurseForge, BlueMap, Discord, Fabric/Forge/NeoForge/Quilt/Paper/Purpur, Bedrock, Geyser, Node.js,
  pnpm. Capitalise an interpolated `${loader}` through the `capitalize()` helper.

### Sentences and punctuation

- Every sentence-shaped string ends in `.`, `!`, or `?`. Bare fragments, single-word labels, and
  short example placeholders do not.
- **`recordEvent({ summary })` history summaries always end in a period** — including the terse
  `Label: detail` lines ("Folder created: plugins/x.jar.", "Server restarted.").
- **In-progress status lines end in `…`, never a period.** This covers `runTask` / progress modal
  titles _and_ every `task.step(...)` / `onProgress(...)` / `onStep(...)` label — sentence-case
  gerunds ("Creating backup…", "Querying Modrinth, CurseForge, …"). A step that reports an outcome
  instead of an ongoing action is a sentence and takes a period ("Shrink skipped because the server
  was running.").
- **No `" - "` as a sentence dash, and no `–` or `—`.** Split into two sentences, use a colon, or a
  parenthetical. Hyphenated compounds are fine.
- Straight quotes everywhere, **except** the field catalog (`src/config/field-catalog/`), which uses
  curly `’` apostrophes internally and consistently — leave those as-is.

### Errors and jargon

- **No infrastructure jargon in user text:** "rebuild the server" not "recreate", "the data folder"
  not `./data`, "stopped for running out of memory" not "OOM-killed".
- **Errors** are friendly and actionable — never a bare status code, a raw `err.message`, raw Zod
  text, or an internal id. Client code has `friendlyError(res | err, { action })` in
  [`public/js/lib/errors.js`](public/js/lib/errors.js) for API-call fallbacks.

## Tests

`node:test`, fast, no Docker or network. In-process integration tests boot the real Express app
against a throwaway DB via [`test/helpers/app.js`](test/helpers/app.js) (`start`, `req`,
`adminCookie`, `seedServer`) — `createApp()` wires only routes/middleware, background services live
in `server.js`, so headless is safe.
