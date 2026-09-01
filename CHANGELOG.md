# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each push is cut as a new release with
its own dated entry.

## [0.11.0] - 2026-09-01

A content-sources release: three new keyless registries, server-side `.mrpack` import,
checksum-verified downloads everywhere, mclo.gs crash analysis, and a batch of compatibility
fixes (Quilt↔Fabric, PaperMC's new Fill v3 API).

### Added

- **Hangar** (PaperMC's plugin registry), **SpigotMC** (via Spiget's `/download/proxy` CDN
  endpoint, which avoids the Cloudflare wall), and **GitHub Releases** as first-class content
  sources - all keyless. They appear as chips in the plugin search modal, work in add-by-link, and
  are covered by the update checker and the one-click updater. GitHub responses are cached with
  ETag/`If-None-Match` revalidation (304s don't count against the rate limit) and an optional
  `GITHUB_TOKEN` env var raises the quota; off-site SpigotMC resources get the same
  browser-download + upload-jar fallback as CurseForge's distribution-denied mods.
- **Universal add-by-link**: the Add-by-URL box now accepts Modrinth/CurseForge/Hangar/SpigotMC
  project pages, GitHub repo/release URLs (bare `owner/repo` too, with SpigotMC's `name.12345` id
  form recognized in URLs), Modrinth slugs, and direct `.jar` URLs.
- **Server-side Modrinth modpack (`.mrpack`) import**: the zip digester detects
  `modrinth.index.json` as a third shape next to CurseForge exports and jar zips. Files are
  canonicalized back into Modrinth projects via the sha1 reverse lookup (keeping real provenance,
  icons, and update-checkability), verified against the pack's sha512 checksums while downloading,
  and previewed with fit verdicts; client-only and non-mod entries are surfaced instead of
  silently dropped; `overrides/` and `server-overrides/` apply in spec order (server wins) with
  the usual pre-apply backups. The wizard's create-from-zip flow accepts `.mrpack` too and
  prefills loader, MC version, and loader build from the pack's dependencies.
- **Checksum-verified downloads**: every registry install streams through the strongest digest the
  registry publishes (sha512 → sha256 → sha1 → md5; CurseForge's numeric algo codes handled) and a
  mismatch aborts the install before anything reaches the server.
- **mclo.gs crash sharing + insights**: crash-report cards gain _Share to mclo.gs_ (publishes the
  report as a public paste behind an explicit confirm; the link is remembered so nothing uploads
  twice) and _Analyze_ (mclo.gs's automated analysis - known problems with suggested fixes -
  rendered in a modal).

### Fixed

- **Quilt servers now see fabric-tagged builds** in search, version pickers, update checks, and
  zip-import verdicts (Quilt runs Fabric mods; most projects only tag "fabric") - previously the
  Quilt catalog was nearly empty.
- **Paper build lists migrated to PaperMC's Fill v3 API** - the legacy `api.papermc.io/v2`
  endpoint stopped receiving new versions and 404s for Minecraft releases above 1.21.11, which
  silently emptied the Paper build picker for new versions. Fill's
  `STABLE`/`RECOMMENDED`/`ALPHA`/`BETA` channels map onto itzg's `default`/`experimental`
  `PAPER_CHANNEL` vocabulary.
- **Modrinth rate limits** on bulk sweeps (the update checker) now wait out short reset windows
  and retry once instead of failing the run on the first 429.

## [0.10.0] - 2026-08-28

A large operability release: structured logging, rate limiting, a dedicated at-rest encryption key,
reliability work across the backup and lifecycle paths, a client-side avatar cropper, and a
project-wide copy pass. It also folds in the npm→pnpm migration and a round of dependency major
bumps. Two behaviour changes below need a note before you upgrade.

### Upgrade notes

- **At-rest encryption moved to a dedicated key.** Stored credentials (API keys, RCON passwords,
  TOTP secrets, the Discord webhook URL) are now encrypted with a random key at
  `$DATA_DIR/.secret-key`, generated automatically on first boot, **independent of
  `SESSION_SECRET`**. Values written under the old `SESSION_SECRET`-derived key still open (it's
  kept as a decrypt-only fallback) and are re-encrypted under the dedicated key automatically on the
  next boot. **Back up `.secret-key` with the rest of `data/`** - losing it means re-entering every
  stored credential. A `.secret-key` file that exists but doesn't parse is now a hard boot error
  rather than being silently regenerated.
- **Session cookie `SameSite` default is now `lax`** (was `strict`), configurable via
  `COOKIE_SAMESITE`. This fixes "remember me" appearing to log users out after following a link
  from another site. State-changing requests are still `Origin`-checked; with `COOKIE_SAMESITE=none`
  the panel additionally rejects writes that carry no `Origin`/`Referer`.

### Added

- **Structured logging (Pino).** Every module logs through `src/logger.js`; one JSON line per
  request; a secret-redacting sanitizer; `makeFailureThrottle()` for background loops; a dormant
  Sentry seam (`src/instrument.js`). New env: `LOG_LEVEL`, `LOG_PRETTY`, `MSM_EXIT_ON_FATAL`
  (hard-exit on an uncaught fault, for supervised deployments), and an inert `SENTRY_DSN` block.
- **Rate limiting.** `express-rate-limit` on all of `/api` (`RATE_LIMIT_API_PER_MIN`, default 1200)
  and on login / 2FA / setup POSTs (`RATE_LIMIT_AUTH_PER_15MIN`, default 100); `0` disables a
  limiter. Plus an account-global soft login counter alongside the existing per-IP one.
- **Health & monitoring endpoints.** `GET /healthz` (unauthenticated liveness; checks the DB;
  deliberately returns no version) and `GET /api/status/summary` (authenticated: current problems,
  recent alerts, disk free) for operators and external monitors. The container `HEALTHCHECK` now
  hits `/healthz`.
- **Discord "Alerts" category.** OOM, unhealthy, stalled boot, stop-failed, failed schedule, quota
  stop, offline-after-restart, crash loop, crash report, and update-failed are forwarded under a new
  toggleable category (on by default). See the new [integrations guide](docs/integrations.md).
- **Automatic daily backups + panel-DB snapshots.** Every new server is seeded a daily backup
  schedule on create (staggered 02:00–05:59). The panel's own database is snapshotted via
  `VACUUM INTO` to `data/backups/_panel/` on a daily timer (newest 14 kept), and an
  `integrity_check` pragma runs on boot.
- **Avatar cropper.** Custom profile-picture uploads now pass through a client-side square-crop
  step (drag / corner-resize) before upload; oversized rasters are downscaled before the crop UI so
  a large photo can't OOM a mobile browser.
- **Explicit container healthcheck (`mc-health`)** so `docker inspect` "healthy" means the server
  accepts players, not just that the process started.
- **Update checking extended** to Docker-image staleness and, for servers with no managed pack,
  explicit Minecraft-version / loader-build pins (Paper/Forge/etc.).
- **esbuild client bundle.** `pnpm run build` now also produces `public/dist/js/`; the app serves it
  when present and raw source otherwise.
- **New docs**: `docs/integrations.md`; refreshed backups / architecture / updates / getting-started
  / users-and-roles / 2FA guides and the README env table.
- **Import zip on the Mods tab** - one button, two zip shapes, auto-detected. A **CurseForge
  modpack export** (`manifest.json`) is resolved through the CurseForge bulk endpoints (two POSTs
  instead of ~170 GETs for an 87-mod pack), previewed with per-mod warnings, and installed as
  custom mods with real task progress. A **hand-assembled zip of jars** gets each jar identified
  (Modrinth sha1 lookup, then CurseForge fingerprint, then the jar's own metadata) and judged
  against the server: fits / wrong loader / wrong MC version / already installed / unidentified.
- **Pack overrides, opt-in and reversible** - a modpack export's `overrides/` tree can be applied to
  the server; every file that would be overwritten is backed up first to `.import-backups/<timestamp>/`
  inside the server folder. Zip-slip-guarded, size-capped, and the backup tree itself is protected.
- **Create a server from a zip** - the wizard's From-modpack tab takes a custom zip: the manifest
  (or a majority vote across identified jars) prefills the loader and Minecraft version, then create,
  bulk install, optional overrides, and start run as one task. Zips of plugins create Paper servers.
- **CurseForge search on the existing-server Mods tab** - platform chips (Modrinth default,
  CurseForge once the API key is stored), with **Installed** badges on results already on the server.
- **Blocked downloads handled up front** - when a CurseForge author forbids API downloads, the
  search modal swaps Install for **Open CurseForge** + **Upload jar**, and zip imports partition
  those mods into a report with per-mod browser links and upload slots.
- **Datapack support on the Mods tab** and an **opt-in override for Modrinth's MC-version
  compatibility filter**, so a build not listed for this exact version or loader can still be
  installed with a clear "not verified" warning.
- **Solver goes cross-platform** - the Auto-detect compatibility solver accepts CurseForge mods
  alongside Modrinth ones, mapping each CF project's file history into the same loader and
  MC-version intersection.
- **Per-server OpenAI-compatible chatbot** - admins can connect each Minecraft server to its own
  Ollama or OpenAI-compatible endpoint and configure the model, invocation name (`@wizard` by
  default), persona, join greeting, timed check-in, opt-in conversation window, and transcript
  retention. Vanilla recipe questions use versioned game data and compact 2x2/3x3 chat grids.
- **Optional chatbot powers** - Basic users may receive enabled self/world powers; separately named
  Power controllers may affect another exact online player. Gifts, healing, feeding, spawn/time/
  weather changes, and directional teleports are individually configurable and audited. Powers
  start disabled and in dry-run mode; configuration and transcripts are admin-only; API keys are
  encrypted at rest; LAN endpoints are accepted while link-local and metadata targets stay blocked.
  The model never receives raw RCON: it can select only intent-matched structured tools whose
  authorization, target, item, quantity, cooldown, and dry-run policy are validated again right
  before execution; selectors are rejected, cross-player targets must be online and cannot be the
  caller, and models without tool calling fall back to conversation only.

### Changed

- **Package manager: npm → pnpm** throughout (scripts, CI, Dockerfile, docs).
- **Dependency majors**: express 5, zod 4, multer 2, dockerode 5 (closes a uuid buffer-bounds
  advisory), plus croner / dotenv / js-yaml / express-handlebars / marked and the dev toolchain
  (eslint 10, typescript 7, @types/node 26). Node ≥ 24 is now required.
- **Backup retention is capped per reason** (scheduled 10, pre-update 10, manual 20) and restore /
  world-reset safety snapshots get their own `pre-restore` bucket (keep 5) so they can never evict a
  `manual` backup you deliberately kept. Each new archive is integrity-checked before it's recorded.
- **Project-wide copy pass**: one house style for casing, punctuation, and error messages; a shared
  `friendlyError()` replaces raw "Request failed (500)" / Zod jargon / leaked container ids.
- **Performance**: prepared-statement cache in the DB layer; the per-page sidebar view models no
  longer fan out per-server pack/update/crash lookups; the WebSocket console stream is brokered (one
  `docker logs --follow` per server, not per tab); static-asset caching; backup zipping moved to a
  `worker_threads` worker; async bcrypt on the login path; memoized analytics reports.
- **First-run `/setup` on a non-loopback bind is PIN-gated** (PIN printed to the console).
- Side-effecting GETs (event export, world download, `.mrpack`) are gated to admin/operator.
- Windows-authored zips whose entry names use backslash separators are now rejected on
  import/restore (a containment tightening in the consolidated extractor).

### Fixed / Security

- **Logging/secrets**: `pino-pretty` moved to runtime dependencies (a pruned prod install could
  crash at boot); the log sanitizer now redacts webhook tokens that live in a URL path and no longer
  over-redacts keys like `sessionId`; one throwing getter no longer discards a whole log line; the
  access log records aborted requests and never 500s on a crafted `X-Request-Id`.
- **Console broker**: a broker is now torn down when its upstream stream ends, so a tab that
  connects afterwards starts a fresh follow instead of getting a stuck, stale stream; one slow
  client is dropped rather than freezing the console for every other viewer.
- **Backups/lifecycle**: the status-refresh overlap guard can no longer wedge permanently on a hung
  Docker call; boot crash-recovery respects crash-loop backoff and no longer emits a false
  "not auto-started" alert for a server it then auto-starts; the "server up" check reads only the
  current boot's logs, not a reused container's previous run; the crash-loop counter only counts
  crashes that actually armed a restart.
- **Discord bridge**: a transient webhook failure retries the event instead of dropping it (bounded,
  so a dead webhook can't wedge the queue).
- **Login lockout**: the account-global counter now decays, so a slow sprayer can't hold a valid
  account locked out indefinitely; the 429 lockout message and "username already taken" now reach
  the user instead of a generic "check what you entered".
- **Analytics / storage / events**: the memoized-report cache is bounded (LRU); the rescan debounce
  is trailing, not leading, so it can't run mid-restore; the Activity type-filter list is
  invalidated after a prune.
- Pre-branch: "remember me" logout on cross-site navigation; a full-project audit pass (per-request
  CSP nonces - no `unsafe-inline` in `script-src`; magic-byte upload sniffing; wizard search
  request-ordering; a shared crash-safe `escapeHtml`); symlink-escape, chat-command-nesting, and
  SSRF/proxy-leak fixes.
- Plugin servers' mod search no longer over-filters: plugin lookups stop being narrowed by a
  mod-loader facet (a spigot-only plugin used to resolve to zero builds on a Paper server), and
  datapack/resourcepack version lookups are no longer filtered by the server's loader either.
  `/api/mods/search` and `/api/mods/versions` accept plugin servers (`loader=paper`, plugin kind)
  instead of rejecting them at validation.
- Post-merge review fixes: the teleport target dropdown on the player page now escapes player
  names (a crafted name on an offline-mode server could otherwise inject markup into an admin's
  page); `sessions.user_id` is backfilled during migration so "sign out other devices" also
  revokes sessions that predate the upgrade; the friendly-validation fallback recognizes zod 4's
  new message wording; the Discord event bridge got the same re-entrancy guard as its sibling
  pollers (no more duplicate notifications when a webhook responds slowly); an intentional stop
  no longer records a spurious "unhealthy" alert while the world saves; the central error
  handlers no longer throw a second error when a download fails mid-stream; the few
  side-effecting GETs (world download, .mrpack, events export) reject cross-site navigations.
- Restore safety: the world displaced during a backup restore is parked next to the server
  directory instead of under tmp (which boot wipes), and boot now recovers it automatically if a
  restore crashed between the two swap renames. Backups also run under the per-server operation
  lock so a concurrent recreate or delete can no longer produce a silently incomplete archive.
- One zip extractor for the whole panel: the decompression-bomb caps moved into the shared
  `utils/zip.js`, every consumer (backups, worlds, blueprints, pack overrides) now uses it, and
  the duplicate `utils/safeExtract.js` is gone. Cached mod icons are served by one mechanism (the
  authenticated static mount, now with the sandbox CSP that keeps a registry-supplied SVG from
  running script); the duplicate API route was removed.

## [0.9.8] - 2026-08-21

Account security lands: opt-in two-factor authentication for every account, plus a round of
security hardening across the file manager, the SSRF guard, the chat-command gate, and the map
proxy. Both are community contributions from @doubleangels, each reviewed and runtime-tested
(including a full upgrade of a populated 0.9.7 install) before merge. New [documentation](docs/)
ships alongside.

### Added

- **Two-factor authentication (TOTP).** Any account - admin, operator, or viewer - can protect its
  login with a standard authenticator app (Google Authenticator, Authy, 1Password, and the like).
  Enroll by scanning a QR code (or entering the key by hand) and confirming a code plus your
  password; you're given ten one-time **backup codes** for when your phone isn't around. Signing in
  gains a second step that asks for the code, and the half-finished session is never treated as
  authenticated until it's passed. Manage or turn off 2FA from the account menu (password required),
  and admins can reset another user's 2FA from **Settings → Users** for the lost-device case. See the
  [two-factor authentication guide](docs/two-factor-authentication.md).
- **A documentation site under [`docs/`](docs/README.md)** - a main index linking to focused,
  screenshotted guides for the dashboard, servers, console & chat commands, modpacks, worlds & files,
  backups, blueprints, schedules, storage, updates, activity, users & roles, and 2FA.

### Fixed / Security

- **File-manager path containment now covers symlinks.** Every file operation already refused `..`
  traversal and absolute paths; it now also rejects symlinks that resolve outside a server's data
  directory - including dangling links to a not-yet-existing target - so a mod or plugin can't plant
  a link to read or write elsewhere on the host.
- **SSRF guard hardened.** Server-side fetches of user-supplied URLs (mod and icon downloads) now
  block additional IPv4-mapped IPv6 spellings of internal addresses (leading-zero groups and the
  embedded dotted-quad form) that previously slipped through to loopback and cloud-metadata, while
  still allowing ordinary public domains.
- **Chat-command gate tightened.** Dangerous console commands (`stop`, `op`, `ban`, …) are blocked on
  low-permission triggers even when nested inside an `execute … run …` chain, without wrongly
  blocking ordinary chat text that merely mentions those words.
- **Map proxy no longer forwards your session.** The BlueMap proxy strips the panel session cookie
  and any authorization header before forwarding, so it can't leak to a target reachable by other
  containers on a shared Docker network.
- Fixed the account-menu **Sign out** button doing nothing when its click raced the menu closing.

## [0.9.7] - 2026-08-20

Two community contributions, both runtime-tested against live servers before merge: GT New
Horizons becomes a first-class modpack platform (thanks @pharomwinters), and the server-status
pipeline learns every known `/list` phrasing plus a set of live-cache hardening fixes
(thanks @doubleangels).

### Added

- **GT New Horizons is now a first-class modpack.** The creation wizard's "From modpack" tab has a
  dedicated GTNH card: pick a pack version (stable by default, betas behind a toggle) and the panel
  pins it, sizes the server for it, and installs it in one task. Pinning means restarts can never
  silently upgrade the pack - the same rule every other modpack already followed.
- **GTNH servers pick their own Java.** GTNH's release index states the highest Java each pack
  version supports, so the panel runs 2.8.0+ on **Java 25** and older releases on Java 21 or 17
  automatically, instead of stranding a 1.7.10 pack on Java 8. Overriding the image tag by hand
  still wins.
- GTNH packs take part in update checks (respecting the channel they were pinned from), blueprint
  export/import, and the guarded upgrade flow with pre-update backup and rollback.
- GTNH pack changes pass Forge's world-migration auto-confirm flag (`-Dfml.queryResult=confirm`,
  the same one GTNH's own start scripts use), so upgrading a pack over an existing world no longer
  blocks forever on a console prompt nothing can answer. The pre-update backup remains the safety
  net.

### Fixed

- **Server cards no longer get stuck on a boot-phase label** (e.g. "Finishing startup") when a
  server's `/list` reply isn't parseable. The parser now knows all three known phrasings - vanilla
  "N of a max of M", Paper 26.2's "N out of maximum M", and the 1.7.10-era "N/M" every GTNH server
  speaks - and when none match but RCON answers cleanly, the card shows "Player count unavailable"
  instead of a stale boot phase.
- The two copies of the `/list` regex (live cache and player service) are consolidated into one
  shared parser, closing a live-save corruption hazard: an unparseable player list used to read as
  "nobody online", which could let a player's `.dat` file be edited on disk while they were on the
  server.
- A container restart the live cache missed no longer keeps the previous boot's player list and
  uptime as live data; all latched state resets when Docker's own start time changes.
- `docker exec` calls no longer pay an extra daemon round trip per command, and a command whose
  output was already captured can no longer be reported as failed by a late inspect error.
- Fresh GTNH installs actually install: the panel no longer sets `SKIP_GTNH_UPDATE_CHECK`, which
  told the image to skip the code path that downloads the pack in the first place and crash-looped
  every new GTNH server on missing files.
- Pack upgrades no longer time out at 10 minutes for GTNH, which downloads a ~1–2 GB server pack
  and builds a several-hundred-mod world on first boot; it now gets 30 minutes before the upgrade
  is treated as failed.

## [0.9.6] - 2026-08-10

Fixes the item browser (used for giving/placing items) coming up empty on vanilla-ish
servers, adds item icons, and fixes Bedrock (Geyser/Floodgate) players being effectively
invisible to whitelist/ops/bans/kicks/teleports/inventory/chat and their own player page.

### Fixed

- **Item browser returned no results for vanilla items** - `itemRegistry.js` built its
  item list by scanning the server's own jar for `assets/minecraft/lang/en_us.json`, but
  official Mojang **server** jars never actually ship `assets/` (that's client-jar-only),
  so every `minecraft:*` item silently came up missing - modded items were unaffected
  since mod jars do ship unobfuscated lang files. When the server jar has no lang data,
  the registry now falls back to an offline-cached, version-matched vanilla item/block
  list from PrismarineJS/minecraft-data (MIT), with proper nearest-version resolution
  (minecraft-data's `latest` folder turned out to only hold protocol data, not items -
  version discovery now checks the real directory listing instead of trusting it).
- **Item browser now shows an icon per row** - `GET /api/servers/:id/items` returns an
  `iconBase` resolved from PrismarineJS/minecraft-assets (MIT) for the server's MC
  version; the browser tries the item texture, falls back to the block texture, then a
  generic glyph (mainly for modded items, which this asset pack doesn't cover).
- **Bedrock players were invisible almost everywhere in the panel** - Floodgate prefixes
  a Bedrock player's username with a "." (or "*") by default, but roughly a dozen
  hand-duplicated username regexes across the codebase (`^[A-Za-z0-9_]{1,16}$`-shaped)
  never allowed that prefix. Concretely this meant: the player-detail page 404'd the
  moment you clicked a Bedrock player in the roster; join/leave/chat/death lines for
  them were silently dropped from the activity feed; and whitelist/op/ban/kick/teleport/
  inventory/chat-target actions all rejected their name with a 400. Consolidated every
  one of those checks into a single shared pattern (`src/utils/playerName.js` /
  `public/js/lib/playerName.js`) that accepts the Bedrock prefix. The player roster and
  player-detail page also now show a controller icon + "Bedrock" chip for these players
  instead of a bare "." avatar initial.

## [0.9.5] - 2026-08-10

Server containers now actually run in the panel's configured timezone, instead of only the
scheduler ([0.9.3]) and BlueMap's map configs ([0.9.4]) knowing about it.

### Fixed

- **Container clock stayed on UTC regardless of Settings → Localization** - `assembleEnv()` in
  `src/services/servers.js` built every container's env without ever setting `TZ`, so the itzg
  image defaulted it to UTC. The Minecraft server's own console timestamps, and any other
  in-container tooling that reads `TZ` (e.g. `mc-server-runner`'s own log lines), stayed in UTC
  even after the panel's timezone was set to something else. `assembleEnv()` now defaults
  `env.TZ` to `settings.getTimezone()` when a server doesn't already set its own `TZ` via the
  advanced env fields.
  - This only takes effect on container **creation** - an already-running server needs to be
    recreated (not just restarted) to pick up the new env var, same as any other advanced
    Docker setting change.

## [0.9.4] - 2026-08-10

Fixes the live map (BlueMap) failing entirely on any server whose world isn't literally named
"world".

### Fixed

- **BlueMap couldn't find a custom-named world** - enabling the live map never told BlueMap what
  the server's actual world folder is. BlueMap only auto-generates its per-dimension map configs
  (`maps/world.conf`, `world_nether.conf`, `world_the_end.conf`) once, on first launch, guessing
  the folder is literally named `world`/`world_nether`/`world_the_end`. Any server using a custom
  level name (`LEVEL` env, a renamed/switched world) got every generated map pointed at a folder
  that doesn't exist - BlueMap logged "problem with your BlueMap setup" for each one and disabled
  itself entirely ("no valid maps configured"), even though the world was completely fine.
  `src/services/map.js` now writes (or, for a setup that already hit this, surgically patches -
  every other line an admin or BlueMap itself set stays untouched) the correct `world:` path for
  whichever world is actually active, both when the map is first enabled and whenever the active
  world changes afterward (rename or switch, via a new hook in `services/worlds.js`'s
  `setActiveLevel`). Nether/end configs are only written once those dimension folders actually
  exist, so a fresh world with an unvisited Nether doesn't get a bogus entry either.

## [0.9.3] - 2026-08-10

Scheduled tasks (restart / backup / RCON commands / global maintenance) fire at the right
real-world time again.

### Fixed

- **Schedules ignored the configured panel timezone** - `src/services/scheduler.js` created every
  croner job without a `timezone` option, so `"0 3 * * *"` fired at 3am in the SYSTEM's timezone
  (UTC in almost every container) rather than 3am in whatever zone Settings → Localization has
  configured. A scheduled RCON command, restart, or backup could run hours off from what the
  cron expression visually says. All four `new Cron(...)` call sites (job creation, validation,
  the `next run` computation in `listSchedules`, and the `/api/schedules/preview` endpoint used
  by the New Schedule modal's live preview) now pass `{ timezone: settings.getTimezone() }`.
- Changing the timezone in Settings now re-arms every already-created schedule immediately
  (new `scheduler.rearmAll()`, called from `POST /api/settings/localization`) - previously an
  existing schedule kept running on whichever zone was in effect when it was created until the
  panel restarted.

## [0.9.2] - 2026-08-10

Fixes the live map (BlueMap) never coming up through the panel's proxy for containerized-panel
deployments, especially reverse-proxy setups (Pangolin, NGINX, Traefik…) where a server's Docker
network is set so the proxy reaches it directly.

### Fixed

- **Live map proxy couldn't reach a sibling container in several common topologies** -
  `src/web/routes/mapProxy.js` previously always dialed `127.0.0.1:<hostPort>`, which is only
  correct on bare metal. It now tries, per server: every Docker-network IP the sibling container
  has (its own container port, no host-port involved - this is what actually works when a
  server's network is set in Advanced Docker Settings for a reverse proxy to reach it directly),
  then the host-published-port path via `host.docker.internal` (containerized panel) or
  `127.0.0.1` (bare metal). Whichever answers is cached per server (re-probed if it later stops
  responding) so the extra connectivity check doesn't slow down every tile/asset request.
  `docker-compose.yml` adds the `extra_hosts: host.docker.internal:host-gateway` mapping the
  fallback path needs on Linux, plus a commented example for joining the panel to a shared
  reverse-proxy network so the direct-container-IP path has a route. New `MAP_PROXY_HOST` env var
  overrides the auto-detected host outright.
- **Live-map readiness probe used `HEAD`** (`public/js/pages/map.js`) - switched to `GET`, since
  BlueMap's bundled webserver isn't guaranteed to implement `HEAD`; a probe that never succeeds
  looked identical to "BlueMap just isn't up yet" and retried forever.
- The map proxy's error response now distinguishes "the map-proxy host name itself didn't
  resolve" (almost always a missing `extra_hosts` entry) from "BlueMap isn't responding yet",
  instead of one generic message for both.

## [0.9.1] - 2026-08-09

Full control over the generated Docker container - name, network, ports, volumes - without ever
leaving the panel or reaching for the CLI.

### Added

- **Advanced Docker Settings** - review and override the container the panel is about to create
  (or has already created):
  - **Custom container name**, overriding the fixed `msm-<id>` pattern (e.g. `survival-smp`
    instead of a randomized-looking ID). The `msm-` prefix itself is reserved - it's how the
    panel resolves servers without a custom name, so a custom one there could shadow another
    server's container.
  - **Docker network selection** - attach to an existing host network instead of the default
    bridge, for reverse proxies like Pangolin or NGINX. New `src/docker/networks.js` lists the
    host's networks via the Docker Engine API.
  - **Extra port mappings** and **extra volume binds** beyond the built-in game/RCON/Bedrock
    ports and single `/data` mount - e.g. UDP 19132 for Bedrock/Geyser, TCP 8100 for BlueMap, or
    a host config directory mounted straight into the container. Volume binds accept any
    absolute host path by design (the panel already holds Docker-socket, root-equivalent access);
    only basic sanity checks (absolute path, no NUL bytes) apply. **Admin-only**: because binds
    reach arbitrary host paths, every entry point (all four creation paths, the Settings PATCH,
    and the preview/networks endpoints) rejects these fields for the operator role, and the UI
    sections render only for admins.
  - Opt-in, under the wizard's existing "Advanced options" toggle - one-click creation for casual
    use is unchanged. Available across all four creation paths (vanilla/plugin wizard, from-pack,
    from-mods, blueprint import) and, post-creation, from a new "Docker settings" card on the
    server's Settings tab, applied via the existing Recreate flow.
- **"Preview as YAML"** - an editable text preview of the generated container params
  (new `src/services/dockerSpec.js`, using the new `js-yaml` dependency) that parses edits back
  into the same structured fields on Apply. Re-validated server-side both on Apply and again on
  the real create/update request - the textarea's contents are never trusted just because they
  started from a server-generated preview.
- Migration `007_docker_advanced.js` adds `container_name`, `network_name`, `extra_ports_json`
  and `extra_binds_json` to `servers`; NULL/`[]` defaults keep every pre-existing server's
  container byte-identical (default name, bridge network, single `/data` bind) with no backfill
  needed.

### Fixed

- **GHCR image name is now lowercased before build** - the `Docker` workflow derives `IMAGE_NAME`
  from `${GITHUB_REPOSITORY,,}` before `docker/build-push-action` runs. Docker/OCI tags must be
  all-lowercase, so a mixed-case GitHub owner or repo name (e.g. `OwenWright8/...`) previously
  failed the build outright.
- **Port-collision check missed ports it should have known about** - `dbPortsInUse` (used to
  suggest and validate ports) now unions in each server's extra port mappings and BlueMap's own
  web-server port (tracked separately in the `integrations` table), closing a latent gap where a
  freshly suggested port could silently collide with either.

## [0.9.0] - 2026-08-09

Containerized deployment (closes [#1](https://github.com/anefzaoui/minecraft-server-manager/issues/1)):
the panel itself can now run as a Docker container, with a pre-built multi-arch image on GHCR and an
official compose file - no clone-and-build needed for Portainer/Dockge-style hosts.

### Added

- **Pre-built image on GHCR** - a new `Docker` workflow publishes
  `ghcr.io/anefzaoui/minecraft-server-manager` (`:latest` + immutable `:v<version>`) for
  linux/amd64 and linux/arm64 on every push to main.
- **`Dockerfile`** - two-stage build: full install + Tailwind CSS compile in the build stage,
  production-only `node_modules` in the runtime stage (`views/`, `src/`, and the built `public/`
  included; `scripts/` is copied before `npm ci` so the postinstall hook resolves, with
  `MSM_SKIP_POSTINSTALL` deferring the CSS build to its explicit step). Ships
  container-appropriate defaults (`PANEL_HOST=0.0.0.0`, `DATA_DIR=/data`) and a `/login`
  healthcheck.
- **Official `docker-compose.yml`** - single required variable (`DATA_DIR_HOST`), used both as the
  `/data` bind source and passed to the panel; mounts the host Docker socket; documents
  reverse-proxy and secret-pinning options inline. Game ports need no mapping here - servers are
  sibling containers that publish directly on the host.
- **`DATA_DIR_HOST` host-path translation** - the piece that makes a containerized panel actually
  work: bind mounts are resolved by the Docker daemon against the _host_ filesystem, so a panel
  that sees its data at `/data` must describe it in host terms when creating server containers.
  New `src/docker/hostPath.js` re-roots every panel-local path at the Docker boundary (server
  `/data` binds plus the root-container `rm`/`chown` fallbacks), refuses paths outside `DATA_DIR`,
  follows the host's path-separator convention (Linux container ↔ Windows daemon and vice versa),
  and is the identity when `DATA_DIR_HOST` is unset (bare metal - behavior unchanged). Config
  validates that `DATA_DIR_HOST` is absolute and fails fast otherwise. Covered by a new
  `test/hostPath.test.js` suite.
- **README**: new "Run the panel itself in Docker" section (quick start, sibling-container model,
  why `DATA_DIR_HOST` exists, reverse-proxy binding, docker-socket security note) and a
  `DATA_DIR_HOST` row in the env table; `.env.example` documents the variable.

### Changed

- `containers.createContainer` takes `spec.dataDir` (panel-local, re-rooted internally) instead of
  `spec.dataDirHost`; `removeDataDir`/`chownDataDir` likewise translate at the bind site.

## [0.8.0] - 2026-07-16

Full-surface UI overhaul: every page, tab, partial, layout and page script audited
(five parallel review passes, ~150 element-level findings) and fixed - visual bugs,
broken states, dated patterns, and consistency drift. Backend touched only where a
UI bug originated server-side.

### Fixed

- **Invisible status dot for starting/unhealthy servers** - the dot class was assembled at
  render time (`bg-{{color}}-500`) so Tailwind never generated `.bg-gold-500`; the new
  `statusDot` helper emits full literal classes. Affected the sidebar, dashboard cards, the
  server header, and the public status page.
- **Duplicate server creation closed off** - dismissing a progress modal now settles its
  promise (`runTask` rejects with `dismissed`, callers show a "still running - see the task
  tray" notice) and the wizard's Create button stays busy for the whole flow; the blueprint
  page adds an in-flight guard. Previously a dismissed modal left creation running silently
  with the button re-clickable.
- **Chat double-send** - Enter bypassed the busied Send button; sends are now in-flight
  guarded, and the composer is disabled with a real `<fieldset disabled>` while the server is
  stopped (the old `pointer-events-none` trick let keyboard users send anyway; same fix for
  the world-controls rail).
- **Schedule edits can no longer destroy the schedule** - edit now creates the replacement
  before deleting the original (worst case is a labeled duplicate, never a loss).
- **Toasts rendered behind modal backdrops** (z-50 under z-60) - toasts move to z-65,
  dropdown menus to z-68, and the whole stacking scale is documented in input.css. The
  task-tray panel drops a z-index that was silently capped by the topbar's stacking context.
- **Table truncation that could never engage** - `truncate` inside auto-layout cells let long
  file/mod/backup/world/pack names push actions into horizontal scroll; name columns now use
  `w-full max-w-0` (+ `title`) across files, mods, backups, updates and worlds tables.
- **Handlebars falsy-zero bugs** - `min="0"`, `max`, `step` and zero defaults were silently
  dropped in catalog fields; a new `isDefined` helper fixes constraints and placeholders.
- **Console**: command replies no longer hide below the full-height empty placeholder; the
  empty state clears on first output; filters that hide every line say so; the stream shows a
  visible "disconnected - reconnecting" marker; a leading `/` is stripped to match the
  decorative prompt; command history is deduped.
- **Metrics charts were never themed** - a dead expression left Chart.js's default #666 axes;
  axes/grid/legend now derive from the theme tokens and re-theme on toggle. Reconnects back
  off (a stopped server was polled flat-out every 5s forever) and pause while the tab is
  hidden so gaps aren't drawn as continuous lines.
- **Dashboard live hydration now moves the status dot** - a crashed server used to keep a
  green pulsing "Running" until manual reload (`/api/servers/live` now includes each server's
  status; stale CPU/memory numbers are cleared for stopped servers). The Docker tile shows an
  "Unknown - retrying" state instead of an eternal "Checking…"; the card filter matches
  name/flavor/version/tags instead of the whole card text (typing "cpu" matched every card)
  and shows a "no matches" message.
- **`fmtBytes` floor bug** - three drifted copies all rendered 0 bytes as "1 KB" ("Total:
  1 KB in 0 archives"); one shared `lib/format.js` matches the server-side `bytes` helper.
- **Light-theme-invisible selection** on accent/icon pickers (white ring on white card) -
  all pickers now use the theme-aware `.swatch`/`.tile` selected ring driven by
  `aria-pressed`.
- Inventory: Enter in item search double-fired the request; the Delete-item and
  Clear-ENTIRE-inventory confirms rendered as green primary buttons (now `danger`).
- Mods: a network error stranded "Searching…" forever (try/catch + stale-response guard);
  the URL-install meter never reset after a failed install; the filter matched button labels
  ("disable" matched every row); pack-manifest links are scheme-checked.
- Worlds: cancelling an upload now aborts the XHR (a "cancelled" upload used to finish and
  reload the page minutes later); copy-to option values are escaped.
- Modpacks/settings/etc.: `pack.versions[0]` TypeError guard; role-change failures revert in
  place instead of reloading over their own error toast; search/timeline/version-resolve
  requests carry stale-response guards (modpacks, analytics, wizard, Modrinth search).
- Kick now flips the player page/roster to Offline instead of leaving a pulsing "Online" dot
  with a re-clickable Kick; modal initial focus lands on the first body field instead of the
  close-X; opening a modal no longer shifts the page by the scrollbar width
  (`scrollbar-gutter: stable`); Escape closes the mobile sidebar; a flex-centered bare layout
  (login/setup/status) no longer clips content taller than the viewport; future timestamps no
  longer render "just now"; remote changelog URLs are validated to http(s) server-side;
  "1 crash"/"dependencyies"-style pluralization fixed everywhere via a `plural` helper.

### Added

- **Motion pass - everything that changes state now moves** (all of it collapsed to a single
  instant frame under `prefers-reduced-motion`):
  - **Segmented controls become sliding pills.** A new `lib/seg.js` injects a `.seg-pill`
    into every `.seg` - the raised key glides between segments instead of teleporting.
    Selection already lives in `aria-pressed`/`aria-selected`, so every existing segmented
    control (wizard tabs, chat Tellraw/Say, dashboard view toggle, platform pickers, item
    browser, teleport dialogs - including ones created later inside modals) is upgraded with
    zero page-code changes; layout shifts reposition without a misleading glide, and the
    plain CSS state remains the no-JS fallback.
  - **Checkboxes** grow their checkmark in with a small overshoot (and shrink it out on
    uncheck); **radios** animate the dot out from the center via a registered
    `--msm-radio-r` custom property; **toggles** get tactile physics - the knob squashes
    toward the direction of travel while held down (edge-anchored `scaleX`, so it can never
    leave the track) and glides with a fast-settle curve, deliberately without overshoot:
    both resting positions sit flush against the track edges.
  - **Modals** fade their backdrop in and out with a subtle panel shrink on close (logic
    still fires immediately - only the removal waits); **dropdown menus** and the **task
    tray panel** scale out of their trigger edge, origin-aware when a menu flips upward.
  - **Chat messages** slide in as they arrive (history replay deliberately doesn't);
    **inputs** ease their focus ring in; swatch/tile selection rings animate via their
    existing transitions.
  - Progressive extra: on browsers with `interpolate-size`, collapsible
    `<details class="card">` sections animate open/closed instead of snapping.

### Changed

- **Chat tab redesigned** (the priority): recipient + mode share one aligned 38px row; the
  17 color swatches and five style toggles are a compact toolbar attached to the message
  input; a live preview line renders the styled message exactly as it lands in-game
  (including a scrambling §k obfuscated preview and a readable glow for dark colors on the
  dark trough); messages get panel-TZ timestamps and sender tooltips; auto-scroll only sticks
  when already at the bottom; long messages wrap. **Chat history is now server-side** -
  recent sends (already recorded as events) render on load, shared across admins, surviving
  reloads.
- **Toast-then-reload is gone from day-to-day flows** - player role toggles, ban/pardon/kick,
  ban-IP add/remove, command prefix saves, test runs and deletes all patch the DOM in place;
  deletes that empty a table restore its empty state instead of leaving orphaned headers.
- **Timestamps honor the panel timezone everywhere** - views emit `data-ts`/`data-ts-ago`
  hydrated through the shared datetime lib (dashboard activity, activity page, backups,
  worlds, schedules - which showed UTC in the table and panel-TZ in the modal for the same
  schedule - settings users, updates, storage, file managers, crash cards).
- **New primitives**: `.notice` (+ ok/warn/danger/info) replaces every ad-hoc callout box;
  `.swatch` (color tiles with a theme-aware gap-ring selected state); `.tile` (wizard
  pickers); `.subtab` (server sub-nav pills); `.meter-indeterminate` (honest sliding-block
  meter replacing all fake `animate-pulse` bars - task tray, wizard, blueprints, worlds,
  mods); disabled styles for `.input`, `.msm-toggle`, `.seg-btn` and `fieldset:disabled`;
  pressed-state styling for chip toggles via `aria-pressed`.
- **Destructive actions separated from safe ones**: Delete server sits behind a divider with
  its own explainer; backup Restore is visually distinct from Download; file/backup/world
  deletes use the trash icon (not the "dismiss" ✕); world Reset uses a distinct glyph from
  backup Restore; the map's Disable is divided from Fullscreen.
- **Dirty-state awareness**: server Settings tracks edits (Discard confirms, leaving warns);
  integrations toggles flag "Unsaved changes" until saved; setup's step 3 blocks Continue
  while typed values are unsaved and reflects the stored CF key.
- Files/file manager: rare row actions (rename/move/copy) collapse into an overflow menu;
  uploads report per-count results safely; the timezone/country pickers are now enhanced
  searchable selects (the last two native selects in the app); the copy-to-clipboard last
  resort is a small modal instead of `window.prompt`; console/chat/map empty states are
  designed (icon + line + action) and theme-correct on the always-dark console; the console
  Download button is a real download link; ANSI log colors map to the brand ramps where they
  exist; wizard cards drop their broken 1-3-4 numbering; Cancel is ghost-weight next to the
  primary; modpack search shows skeleton cards and an honest "top N matches" count; the
  public status page auto-refreshes every 60s; the dashboard list view is a real compact
  list (stats/disk/tags hidden) instead of a cosmetic column change; `overview.js` is renamed
  `world-controls.js` to match what it drives, and the Overview tab gets its own script that
  keeps the "Live usage" card actually live over the stats WebSocket with threshold-colored,
  core-normalized CPU (the raw value exceeded 100% on multi-core servers).

## [0.7.4] - 2026-07-16

### Changed

- **Badges are a closed system**: `.badge` is neutral by default with exactly four semantic
  variants (`badge-ok/warn/danger/info`); all ~40 ad-hoc bg/text colorway combos across every page
  and page script now use them (including the activity-timeline type badges).
- **Themed scrollbars** everywhere - thin, line-colored, transparent track - replacing the stock
  OS bar on both themes.
- **Tables**: cells move to `px-4` so first/last columns align with card headers and padding.
- **Inputs**: hover now strengthens the border (stone-500, reads stronger in both themes); help
  text is capped at prose width instead of running the full card.
- **Numbers that update live** (dashboard stat cards, server live-usage, storage total, status
  page) render with tabular numerals so they don't jitter as values change.
- **Modals**: header/body/footer padding normalized to the card rhythm (p-5).
- Sidebar/menu items get a visible focus ring; collapsible catalog sections highlight their
  summary row on hover; the console gets the same recessed-trough inner shadow as the meters;
  the wizard's selected-mod chips move from pills to the blocky register; the last three
  dark-only notice boxes (mods manual-download, commands/players whitelist notes, settings
  headroom "healthy" state) are theme-safe; "Export" → "Export blueprint".

## [0.7.3] - 2026-07-16

### Changed

- **One segmented control for every pick-one-of-N group.** New `.seg`/`.seg-btn` component replaces
  four divergent ad-hoc patterns (ghost-buttons-in-a-box, chip toggles, inset tablists). Segments are
  the exact height of inputs (38px) so platform pickers align with their search field, have real gaps
  between items, style their active state off `aria-selected`/`aria-pressed` (raised key + lit top
  edge + green text), and inactive hover changes text only - a hovered segment can no longer be
  mistaken for the selected one. Converted: wizard source tabs, mod-mode, all three
  Modrinth/CurseForge pickers, dashboard grid/list toggle, chat Tellraw/Say, and both
  teleport-dialog tab rows. Segments are exempt from the global press-down effect (selected tabs
  no longer bounce).
- **Simple/Advanced is now an "Advanced options" switch** in the wizard toolbar - a boolean control
  for a boolean choice - instead of a two-item tab group.
- **Server icons are the official Minecraft sprites** (isometric grass block, creeper head, diamond,
  TNT, chest, diamond sword, potion, end portal frame) from minecraft.wiki, replacing the hand-drawn
  rect-mosaic SVGs. © Mojang, attributed in the README, excluded from the MIT license.
- Tile pickers (loader, server type, icon, accent color - wizard and server Settings) keep a
  constant 2px border and swap only its color, so selecting no longer shifts the row by a pixel.
- Tooltips: only the first tooltip of a scan waits 350ms; neighbors shown while one is (or was just)
  visible appear instantly.
- Modal and toast close buttons are real 32px-hit-target icon buttons (`.icon-btn`) with hover and
  focus-visible states, replacing naked 16px glyphs.

## [0.7.2] - 2026-07-16

### Changed

- **Body font is now IBM Plex Sans** (self-hosted variable woff2, latin/latin-ext/cyrillic/greek
  subsets, 126 KB total), replacing the 876 KB Inter ttf. Plex's engineered grotesque character fits
  a server-infrastructure tool and sits more naturally under the Press Start 2P display face. The
  stylesheet header now states the design system's three commitments (palette, type, structural
  primitive) so future changes have a reference point.
- The wizard's fifth accent swatch is amethyst `#9a5cc6` (from the in-game block) instead of the
  off-palette `#8b5cf6`; the Fabric starter blueprint's accent is diamond `#21a7ab` instead of the
  off-palette `#2f9bd6`.
- MOTD editor: the presets button is plain "Examples" (no emoji), and color swatches highlight with
  a ring on hover instead of scaling.
- Toast and confirm copy: "Starting up!" and "(take a snapshot first!)" reworded without
  exclamation marks.
- README: full copy pass - em-dash density cut to ~1 per 320 words, glossary bullets now use colon
  separators, two ornamental "excellent"s removed. No factual content changed.

### Fixed

- **Light theme now passes WCAG AA for all accent-colored text.** Links and status text previously
  used raw palette classes (`text-diamond-400`, `text-grass-400`, `text-gold-400`,
  `text-redstone-400`) in both themes; on the light canvas those measure 1.9–2.8:1. New semantic
  tokens (`link`, `ok`, `warn`, `danger`) resolve to the 400 steps in dark (6.4–9.5:1) and the
  600/700 steps in light (4.9–7.0:1), and 200+ call sites across every view and page script now go
  through them. Server status text goes through a new `statusText` helper. The always-dark console
  keeps its raw palette classes on purpose.
- **Primary/danger button hover states now pass contrast.** Hover used to lighten
  (grass-500 = 3.1:1, redstone-500 = 3.9:1 under white text); hover now darkens to the 700 step
  (7.0:1 / 6.5:1).
- **Error/warning boxes are theme-safe**: the dark-only `border-*-800 bg-*-900/15 text-*-300`
  pattern is replaced with `border-danger/40 bg-*-500/10` + semantic text, and the dashboard Docker
  warning colors only its title, not the whole paragraph.
- **`prefers-reduced-motion` is now honored globally**: all animations and transitions collapse to a
  single instant frame (status-dot ping, indeterminate meter pulse, spinners, entrance movements);
  state remains readable through color. This was a WCAG-floor gap.
- Progress meters transition `width` only and the settings toggle knob moves via `transform`,
  replacing two `transition-all` rules that animated layout properties.

### Changed (design system)

- **Shadows are a three-level scale mapped to meaning** (`raised` / `overlay` / `modal`, one light
  source, cool-tinted like the stone ramp); the six ad-hoc `shadow-sm/lg/xl` uses (cards, task
  panel, dropdowns, modals, toasts, tooltips) now pick a level. Cards drop their shadow entirely -
  the border and the dark-mode lightness step carry that edge alone.
- Chips move from pill (`rounded-full`) to `rounded-sm`, staying in the product's blocky register.
- Tables set `font-variant-numeric: tabular-nums` so sizes, ports and dates align.
- Table row hover is gated behind `@media (hover: hover)` so touch devices don't stick.
- Sub-scale `text-[10px]` labels bump to the 11px micro-label step (the in-slot inventory stamps
  keep their game-register sizes; full info lives in their tooltips).
- Bare "Save" / "Test" / "Apply" buttons are now verb + object: "Save key", "Test key",
  "Save domain", "Save time zone", "Apply filters".

## [0.7.1] - 2026-07-16

### Security

- **Read-only viewers can no longer exfiltrate RCON passwords or server data.** Two GET routes were
  reachable by the `viewer` role (which `requireWrite` only blocks from writes): the per-server file
  manager and the backup-archive download. Both expose `server.properties`, which the itzg image writes
  with the plaintext `rcon.password` - so a nominally read-only account could recover RCON credentials
  and full server contents. The per-server file manager (`/api/servers/:id/files`) and backup download
  (`/api/backups/:id/download`) are now restricted to `admin`/`operator`.
- **Path traversal in the mod content routes is fixed.** `POST /api/servers/:id/mods/toggle` and
  `DELETE /api/servers/:id/mods/:file` passed the `file` name into a single `dataPath()` join, which
  only guarantees containment within `DATA_DIR` - not within the server's own directory. A crafted
  `../../../panel.db` (or `.session-secret`) name could rename or delete panel-internal files (the auth
  database and the at-rest secret key), a destructive/DoS primitive available to any `operator`. Content
  filenames are now validated as bare names (no separators, NUL, or dot-segments) before any path join.
- **Admin-only pages are now gated.** `/settings` (full user roster, masked API key) and `/storage`
  (largest-file paths across `DATA_DIR`) rendered for any authenticated user, even though their JSON/API
  and file-manager equivalents were already admin-only. Both now require `admin`.
- **Custom SVG server icons can no longer execute scripts.** User-uploaded icons are served under a
  locked-down, sandboxed `Content-Security-Policy` (plus `nosniff`), so a `<script>` embedded in an SVG
  cannot run if the file is opened directly.

### Added

- Regression tests (`test/security-authz.test.js`) asserting the viewer lockout on backup/file routes,
  the mod-route traversal rejection, and the admin gate on `/settings` and `/storage`.

## [0.7.0] - 2026-07-16

### Added

- **"From mods" is now a real modded-server creation hub.** The old chips-and-solver panel is replaced
  by a loader-first browser: pick a **mod loader** (Fabric, Forge, NeoForge, Quilt), a **Minecraft
  version**, and an optional **loader build** to pin, then search **Modrinth and CurseForge** for mods
  compatible with that choice. Results and picks render as a full list - mod icon, name, description,
  downloads - and every selected mod gets its **own version dropdown** so you can pin an exact build.
- **Automatic dependency resolution.** Adding a mod pulls in its **required dependencies** recursively
  (e.g. REI → Architectury API, Cloth Config, Fabric API). Dependencies appear in the list badged
  _"dependency"_ with their own version pickers; you can change a build or remove one, and removals are
  remembered so the resolver won't re-add them. Dependencies with no compatible build are reported, not
  silently dropped.
- **Loader build pinning.** A new service fetches build lists from the Fabric, Quilt, NeoForge and
  Forge registries (cached, best-effort, always offering a "Latest" default), mapped to the matching
  itzg env var (`FABRIC_LOADER_VERSION`, `QUILT_LOADER_VERSION`, `NEOFORGE_VERSION`, `FORGE_VERSION`).
- **One-task modded creation.** "From mods" servers are built by a single server-side task with real
  progress - create (without starting) → install every mod pinned to its chosen build → start - so a
  loader server boots with its mods already present. Individual mod failures are tolerated and reported.

### Changed

- **The "Standard" tab is now "Vanilla."** It covers Vanilla and the plugin flavors (Paper, Purpur);
  the mod loaders moved to "From mods", which is where you pick mods for them.
- **The version picker lists every Mojang channel** - releases, snapshots, betas and alphas - instead
  of releases only, each labelled by channel. (From modpack and From blueprint are unchanged.)
- The compatibility solver is kept as an optional **"Auto-detect from mods"** sub-mode inside From mods
  for when you'd rather have the loader and version chosen from your mod list.

### Notes

- No database schema change was required - loader builds are stored as env vars and pinned mods as
  overlay content, both existing structures. The versioned migration runner already applies any future
  schema changes to your existing `data/panel.db` on startup, so upgrades never assume a fresh database.

## [0.6.2] - 2026-07-15

### Added

- **"Why this over Pterodactyl / Crafty Controller / AMP?"** comparison section in the README.
- **Automated GitHub Releases.** A workflow publishes a tagged Release - with notes pulled straight
  from this changelog - for each new `package.json` version pushed to `main`. It runs on every push
  but is idempotent, so a version is released exactly once; it can also be run from the Actions tab.

### Changed

- The quick start now uses the real clone URL, and the in-app footer shows the live `package.json`
  version instead of a hardcoded "v0.1 preview".

## [0.6.1] - 2026-07-14

### Added

- **Screenshots in the README.** A hero shot plus a 14-image gallery covering the dashboard, create
  wizard, server overview, admin chat, live console, mods, worlds, settings, backups, history, custom
  chat commands, schedules, storage, and blueprints. Images live under `docs/screenshots/`.

## [0.6.0] - 2026-07-14

### Added

- **Admin Chat tab.** A console-style panel (Console → Chat) for sending styled messages in-game
  without hand-writing `tellraw`. Pick a recipient (Everyone or an online player), a mode (**Tellraw**
  styled, or **Say** plain `[Server]` broadcast), a **color** from the 16 vanilla swatches, and any of
  **bold / italic / underline / strikethrough / obfuscated** - laid out as clickable swatches and
  chips. Type, hit Enter, and the message appears in-game and in the panel's chat log (rendered with
  its styling). Targets are validated so entity selectors like `@e[…]` can't be injected.

## [0.5.1] - 2026-07-14

### Fixed

- **Copy buttons now work over plain HTTP (LAN/IP).** The browser's async Clipboard API is only
  available on HTTPS/localhost, so "Copy address" - and the copy-UUID, crash-trace, and
  integration-link buttons - failed with _"Copy failed - select and copy manually"_, and that
  fallback pointed at a `<select>` you couldn't select. Copy now falls back to `execCommand`, and if
  even that is blocked, to a prompt you can copy the value out of by hand.

## [0.5.0] - 2026-07-14

### Added

- **Full control when resetting (re-rolling) a world.** The Reset dialog now lets you keep the current
  seed, roll a **new random** seed, or enter a **custom** seed; optionally switch the **world type**
  (Default / Superflat / Large biomes / Amplified); and choose whether to take a safety backup first -
  all applied on the next start, without recreating the server.

### Fixed

- **The Reset-world dialog no longer renders broken.** Its seed toggle put the label text _inside_ the
  toggle element, so the CSS styled it as a switch track and the text wrapped one word per line. The
  dialog is now a proper form.

## [0.4.0] - 2026-07-14

### Added

- **Guided fix for modpack mods that can't be auto-downloaded.** When a CurseForge pack pins a mod
  whose author disallows automated download (or that was pulled from CurseForge), the install used to
  dead-end with `Failed to auto-install`. The Mods tab now detects itzg's `MODS_NEED_DOWNLOAD.txt`,
  shows a banner, and opens a resolver where each mod offers one-click **Exclude from pack**, **Find
  on Modrinth** (installs a loader-correct replacement and excludes the dead one), or **Upload jar**
  (drops your manually-downloaded file in as an overlay). Exclusions use the mod's real CurseForge
  slug parsed from the download link, so they actually match `CF_EXCLUDE_MODS`.

### Fixed

- **Pack-mod "Disable" now excludes the right project.** It reads the real CF slug/ID from the pack
  manifest instead of guessing from the display name - the old guess silently failed for
  renamed/unofficial mods (e.g. "cc tweaked", whose slug is `unofficial-cc-tweaked-…`).
- **Mod installs now match the server's loader - no more a Fabric jar landing on a NeoForge server.**
  For modpack servers (`AUTO_CURSEFORGE` / Modrinth / FTBA) the loader isn't in an env var, so the
  panel had nothing to filter by and installed whichever build came first (often Fabric). It now
  detects the pack's real loader from the manifest mc-image-helper writes (e.g.
  `.neoforge-manifest.json`), so the Modrinth search list, the search **Install** button, and
  add-by-URL all resolve the correct loader's build - or fail with a clear "no build matches" message
  instead of silently installing the wrong one.

## [0.3.0] - 2026-07-14

### Added

- **Create wizard - PvP (and the full gameplay/`server.properties` set) at creation.** The Simple
  "World & rules" step now has a PvP on/off choice (previously reachable only in Advanced mode), and
  Advanced mode exposes every image/`server.properties` setting. Everything chosen here is applied by
  the image at the **first start**, so the server comes up correct with no extra restart.

### Changed

- **The world-controls PvP toggle is now permanent.** It writes the `pvp` value in `server.properties`
  (applies to everyone, including players who join later; takes effect on the next restart) instead of
  the live friendly-fire team shipped in 0.2.0, which only covered players online at toggle time.
  There is no vanilla live+permanent global PvP switch without a server mod/plugin.

### Fixed

- **Containers now run as the panel's own host user (UID/GID) - the root fix for the file `EACCES`
  errors.** Previously containers wrote files as uid `1000`; when the panel ran as a different host
  user it could not manage its own servers' files, so installing a mod (`copyfile` denied), deleting a
  server, and other operations failed with `EACCES`. Every server now creates files owned by the panel
  user, and servers created before this change are re-owned automatically on their next start,
  recreate, or file operation. This is the actual cause behind the 0.2.0 delete-permission symptom,
  whose fix there was only a fallback.
- **The console no longer shows a `[panel/WARN]: Log stream unavailable … 404 no such container`
  warning** for a server that hasn't been started yet. A missing container is expected before the
  first start, so the stream ends quietly and the "start the server" placeholder stands.

## [0.2.0] - 2026-07-14

### Added

- **World controls - live PvP toggle.** Enable/disable PvP on a running server without a restart,
  using a friendly-fire scoreboard team that online players are joined to (teammates can't damage
  each other); re-enabling disbands the team. Covers players online when toggled - re-toggle after
  new joins.
- **World controls - more gamerule quick-toggles.** Mob spawning, fire spread, fall damage, natural
  regeneration, phantoms (insomnia), and instant respawn, alongside the existing keep-inventory,
  day/night cycle, weather cycle, and mob-griefing toggles. All are live over RCON and reflect the
  server's current state.
- **README - "Networking, ports & remote access".** A ports-at-a-glance table (panel / game / RCON /
  Bedrock / BlueMap), how to bind `0.0.0.0`, host + provider firewall guidance, reverse-proxy (TLS)
  and SSH-tunnel options, and a note on the PM2 Node-version pinning gotcha.
- **README - "Status & areas that need work".** Honest, source-verified limitations of the custom
  RTP, structure/biome finding, item give/take, item listing, and BlueMap features.

### Changed

- **Default panel port is now `25564`** (previously `25580`). It sits one below the game-port runway
  (`25565`+) so game instances number cleanly upward with nothing interrupting the sequence.

### Fixed

- **Deleting a server no longer fails with `EACCES`.** When the itzg container wrote world/mod files
  as its own UID (default `1000`) and the panel runs as a different host user, `rm` was denied. The
  panel now falls back to a throwaway root container that removes the directory regardless of file
  ownership.
- **Permission errors are no longer mislabeled "Docker is not reachable".** That message is now
  reserved for genuine daemon-connection failures; a filesystem `EACCES` whose path merely contains
  "docker" (e.g. `/home/docker/…`) is reported accurately.

## [0.1.0] - 2026-07-14

Initial public release - a complete, self-hosted control panel for Minecraft servers running on the
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) image.

### Core

- **Multi-server lifecycle** - create / start / stop / restart / recreate / delete, with a graceful
  RCON `stop` before container stop, health-aware status, and crash detection with backoff.
- **Guided wizard** - Simple mode or Advanced mode exposing every supported environment variable with
  plain-English help, grouped by section, plus a raw `KEY=value` escape hatch; only non-default
  values are applied.
- **Pinned modpacks** - "latest" is resolved to a concrete version id and pinned at install time.
  Upgrades are explicit: preview → automatic pre-update backup → graceful stop → re-pin → recreate →
  health monitoring → one-click rollback.
- **Custom-mod overlay** - self-added mods are downloaded into a shared, sha256-deduplicated library
  and hard-linked into the server; they survive pack updates, with class-aware disabling.
- **Console, logs & RCON** - live console over WebSocket, ANSI rendering, search/level filters, a
  command bar with history, and a player list with quick actions; a generated, encrypted RCON
  password is injected per server.
- **Player moderation** - whitelist, ops (levels 1–4), bans, IP bans (RCON while running, direct JSON
  edits while stopped), and teleports by coordinates, to a player, or to the nearest biome/structure.
- **Backups & schedules** - save-safe archive/restore with retention classes and free-space
  preflight; per-server and global cron tasks (restart / backup / RCON) with next-run previews.
- **Blueprints (`.mcserver.zip`)** - portable, secret-stripped recipes of an instance (config,
  resources, pinned pack, mod-overlay manifest, chosen config files, optional embedded world); import
  reproduces the server with fresh ports and hash-verified downloads.
- **Storage analytics & quotas** - a background size-indexer walks `./data`, caches sizes, and
  panel-enforces per-server disk quotas, with usage breakdowns, largest-files, orphan detection, and
  trends.
- **History & crash reports** - every action is a structured event with actor and captured log
  excerpts; crash reports are auto-detected, parsed, and exportable.

### Beyond the basics

- **Live world map** - one-click BlueMap install matched to the server's loader, served through the
  panel's authenticated proxy.
- **Analytics & scoreboard** - vanilla stats ingested on a schedule, per-player profiles, and a
  rankable scoreboard.
- **Activity timeline** - every log line classified (chat, joins, leaves, deaths incl. PvP,
  advancements) into a searchable per-server timeline.
- **Inventory forensics** - read any player's inventory/armor/ender chest from playerdata NBT,
  automatic snapshots on join/death, snapshot diffs, cross-player item search, give/clear via RCON.
- **Investigation** - advisory x-ray suspicion scoring from ore-discovery ratios vs the server median.
- **Discord** - encrypted-webhook notifications with per-event toggles.
- **Invites & client modpacks** - a paste-ready invite block plus a generated client `.mrpack`.
- **Pick-mods-first solver** - choose mods and the solver proposes the newest fully-compatible loader
  and MC version pair.
- **Public status page** - optional unauthenticated `/status/<slug>` per server.

### Security

- Localhost-only by default; auth-mandatory with admin/operator/viewer roles enforced on every
  mutation; `SameSite=Strict` cookies + Origin checks; secrets encrypted at rest (AES-256-GCM);
  path-guarded `./data` access; zip-slip-guarded extraction; SSRF-guarded server-side downloads.
