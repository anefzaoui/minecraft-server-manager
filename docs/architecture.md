# Architecture

Minecraft Server Manager is a single-process, server-rendered Node.js application. It manages
Minecraft servers that run as Docker containers using the
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) image, talking to the
Docker daemon over its API (never by shelling out to the `docker` CLI).

## Runtime shape

- **Express + Handlebars** render pages server-side. There is no SPA and no client bundler; the
  browser JS in `public/js/` is hand-written and progressively enhances the rendered HTML.
- **`node:sqlite`** (built into Node ≥ 22.5) is the database - synchronous, zero native modules,
  WAL mode. A small versioned-migration runner applies `src/db/migrations/*` on boot.
- **`ws`** carries the live console and stats streams.
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
- **`ws/`** - authenticated console + stats WebSockets (session cookie verified on upgrade).

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
- **Secrets** (RCON passwords, API keys) are encrypted at rest with AES-256-GCM using a key derived
  from `SESSION_SECRET`. Blueprints strip all secrets on export.

## Data & wire formats

- **`data/panel.db`** - the SQLite database.
- **`data/.session-secret`** - the auto-generated panel secret, created on first run if
  `SESSION_SECRET` is unset. Deleting it rotates the secret (which invalidates sessions and stored
  encrypted secrets).
- **Blueprints (`.mcserver.zip`)** - a zip with a `manifest.json` describing config, resources, the
  pinned pack reference, the overlay manifest (source URLs + sha256), chosen config files, and
  optionally a world. Import re-downloads and hash-verifies each mod and assigns fresh ports.
- **Docker containers** created by the panel are named and labelled so the watcher can find them;
  the panel owns their full lifecycle.

## Boot sequence

1. Load config; ensure/generate the session secret.
2. `ensureDataRoot()` - create the `./data` layout, wipe `tmp/`.
3. Run DB migrations.
4. Seed starter blueprints (guarded).
5. Start the HTTP + WS server.
6. Initialize Docker **in the background** - the UI is fully usable while the daemon is down; Docker
   features light up when it becomes reachable.
