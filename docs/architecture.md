# Architecture

Minecraft Server Manager is a single-process, server-rendered Node.js application. It manages
Minecraft servers that run as Docker containers using the
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) image, talking to the
Docker daemon over its API (never by shelling out to the `docker` CLI).

## Runtime shape

- **Express + Handlebars** render pages server-side. There is no SPA; the browser JS in `public/js/`
  is hand-written progressive enhancement. An esbuild step (`pnpm run build:js`) bundles and
  minifies it into `public/dist/js/`; the app serves that bundle when it's present and the raw
  source otherwise, so a dev run without a build still works.
- **`node:sqlite`** (built into Node; the panel requires Node ≥ 24) is the database - synchronous,
  zero native modules, WAL mode. A small versioned-migration runner applies `src/db/migrations/*` on
  boot. Prepared statements are cached in `src/db/index.js` keyed on the SQL text.
- **`ws`** carries the live console and stats streams. Both are **brokered**: one upstream
  `docker logs --follow` (or `docker stats`) per server, demuxed once and fanned out to every
  connected tab, rather than one upstream per viewer. The console broker keeps a small replay
  buffer for late-joining tabs and drops a subscriber whose socket falls too far behind rather than
  stalling the shared stream.
- **dockerode** is the only way the app talks to Docker. The endpoint is auto-detected per platform
  (Windows named pipe vs. unix socket).
- **All persistent state lives under one directory** (`$DATA_DIR`, default `./data`). Copying that
  directory migrates the entire panel.

## Layering

Dependencies flow in one direction:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parse & validate input, shape responses
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domain logic - the actual features
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastructure
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - one router per domain (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), mounted in `web/app.js`. Routers validate with zod, call a service, and return JSON
  or render a view. Business logic does not belong here.
- **`services/`** - the heart of the app. Each service owns one domain and may depend on
  infrastructure and on other services.
- **`docker/`** - dockerode wrappers: `connect` (endpoint detection + daemon health), `containers`
  (create/start/stop/recreate with bind mounts, memory/CPU limits, and labels), `logs`, `stats`,
  `images`, and a `watcher` that turns Docker events into history + crash detection.
- **`db/`** - the SQLite wrapper and migration runner.
- **`storage/`** - the `./data` bootstrap, the **path guard** (`safeJoin`, the file-safety
  backbone), and the background size-indexer + quota enforcement.

Cross-cutting:

- **`config/`** - environment config plus the **field catalog**: the single source of truth for
  server settings. Every itzg environment variable is catalogued (label, help, type, unit, default,
  validation, section, danger flags). The wizard, settings forms, and zod validation are all derived
  from it, so exposing a new setting is a data change, not new UI plumbing.
- **`events/`** - `recordEvent()` is the one entry point for the history log; lifecycle events also
  capture container-log excerpts to `data/logs/<id>/events/`.
- **`ws/`** - authenticated console + stats WebSockets (session cookie verified on upgrade, `Origin`
  checked to block cross-site hijacking), brokered per server (see "Runtime shape").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returns a per-module
  [Pino](https://getpino.io) logger; level from `LOG_LEVEL`, `makeFailureThrottle()` keeps a
  persistently-failing background loop to one log line plus a "recovered" line.
  `src/utils/logSanitize.js` redacts credential-shaped keys and webhook tokens from the structured
  metadata; `src/config/logLevel.js` is the shared level allowlist (kept separate to avoid a
  require cycle with `config`). `src/instrument.js` is a dormant Sentry seam, loaded first in
  `src/server.js`. `src/web/middleware/requestLog.js` writes one access-log line per request
  (skipping `/healthz` and static assets). ESLint enforces `no-console` under `src/**`, with
  `preflight.js`, `instrument.js`, and `config/index.js` exempt (they run before the logger exists).
- **Rate limiting** - `src/web/middleware/rateLimit.js` puts `express-rate-limit` in front of `/api`
  (`RATE_LIMIT_API_PER_MIN`, default 1200) and the login / 2FA / setup POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, default 100); `0` disables a limiter. It keys on `req.ip`, so
  `TRUST_PROXY` matters behind a proxy. A separate per-account soft counter in
  `src/web/middleware/auth.js` handles the login lockout (per-IP and account-global, decaying).

## Key domain behaviors

- **Modpacks are always pinned.** The image auto-upgrades unpinned packs on every restart, so the
  panel resolves "latest" to a concrete version id at install time and pins it. Upgrades are an
  explicit orchestrated flow (`updates/`): preview → pre-update backup → graceful stop → re-pin →
  recreate → health-monitor → one-click rollback.
- **The custom-mod overlay** is panel-managed: user-added mods land in the deduplicated library and
  are hard-linked into the server so they survive pack updates. Disabling is class-aware.
- **Ports** are allocated from a base scheme (game from `PORT_GAME_START` upward, RCON = game +
  `PORT_RCON_OFFSET`, Bedrock from `PORT_BEDROCK_START`), probed for availability, and reserved in
  the DB.
- **Disk quotas** are enforced by the panel because Docker can't cap bind-mount usage: the indexer
  caches per-directory sizes and disk-growing operations are gated on them.
- **Secrets** (RCON passwords, API keys, TOTP secrets, the Discord webhook URL) are encrypted at
  rest with AES-256-GCM using a dedicated random key at `$DATA_DIR/.secret-key` (mode `0600`,
  auto-generated). It's independent of `SESSION_SECRET`; a `SESSION_SECRET`-derived key is kept as a
  decrypt-only fallback for values written before the dedicated key existed, and
  `src/services/secretsMigration.js` re-encrypts those under the dedicated key once on boot.
  A `.secret-key` that exists but doesn't parse is a hard boot error (it is never silently
  regenerated over the top). Blueprints strip all secrets on export.

## Data & wire formats

- **`data/panel.db`** - the SQLite database. Snapshotted daily via `VACUUM INTO` to
  `data/backups/_panel/` (newest 14 kept); `PRAGMA integrity_check` runs on boot.
- **`data/.session-secret`** - the auto-generated cookie-signing secret, created on first run if
  `SESSION_SECRET` is unset. Deleting it rotates the secret (which invalidates sessions).
- **`data/.secret-key`** - the dedicated 32-byte at-rest encryption key (mode `0600`), auto-created
  on first run. Independent of `SESSION_SECRET`; deleting it makes every stored credential
  undecryptable, so it belongs with your backups.
- **Blueprints (`.mcserver.zip`)** - a zip with a `manifest.json` describing config, resources, the
  pinned pack reference, the overlay manifest (source URLs + sha256), chosen config files, and
  optionally a world. Import re-downloads and hash-verifies each mod and assigns fresh ports.
- **Docker containers** created by the panel are named and labelled so the watcher can find them;
  the panel owns their full lifecycle.

## Boot sequence

1. `require('./instrument')` (the Sentry seam) before anything else, then `require('./preflight')`
   to fail clearly on an unsupported Node version.
2. Load config; ensure/generate `.session-secret` **and** `.secret-key`.
3. `ensureDataRoot()` - create the `./data` layout, wipe `tmp/`.
4. Run DB migrations, then `PRAGMA integrity_check` (logs loudly, points at `data/backups/_panel`
   on failure).
5. Re-encrypt any legacy `SESSION_SECRET`-keyed secrets under `.secret-key` (`secretsMigration`).
6. Seed starter blueprints (guarded).
7. Start the HTTP + WS server. On an exposed bind, print the first-run `/setup` PIN.
8. Install the post-boot runtime guard (catches uncaught faults; `MSM_EXIT_ON_FATAL=1` makes it
   hard-exit for supervised deployments).
9. Start background services: WS broker, storage indexer, crash + inventory watchers, scheduler,
   Discord event bridge, and the **daily maintenance timer** (prune old analytics rows + snapshot
   `panel.db`).
10. Initialize Docker **in the background** - the UI is fully usable while the daemon is down;
    Docker features light up when it becomes reachable. Once connected, `refreshStatuses({ boot })`
    reconciles cached statuses, emits a one-time `offline-after-restart` event for a server that was
    up before the panel restarted and won't be brought back, and the boot loop starts
    `auto_start` servers plus recovers `auto_restart` servers found crashed during the outage
    (respecting crash-loop backoff).

> The instrument-before-preflight order is a deliberate trade-off: it lets a future Sentry wiring
> patch the runtime first, at the cost of a slightly less friendly message on a truly ancient Node.

## Build pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM with code-splitting). `postinstall` runs **CSS only**. `public/css/app.css`
and `public/dist/` are gitignored build artifacts; the Dockerfile build stage runs the full
`pnpm run build` and copies `public/` into the runtime image. Static assets are served
`immutable`/long-cache for fingerprinted files, short-cache for CSS/JS, and `no-cache` for HTML and
`/api`.
