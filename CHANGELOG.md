# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each push is cut as a new release with
its own dated entry.

## [0.8.0] - 2026-07-16

Full-surface UI overhaul: every page, tab, partial, layout and page script audited
(five parallel review passes, ~150 element-level findings) and fixed — visual bugs,
broken states, dated patterns, and consistency drift. Backend touched only where a
UI bug originated server-side.

### Fixed

- **Invisible status dot for starting/unhealthy servers** — the dot class was assembled at
  render time (`bg-{{color}}-500`) so Tailwind never generated `.bg-gold-500`; the new
  `statusDot` helper emits full literal classes. Affected the sidebar, dashboard cards, the
  server header, and the public status page.
- **Duplicate server creation closed off** — dismissing a progress modal now settles its
  promise (`runTask` rejects with `dismissed`, callers show a "still running — see the task
  tray" notice) and the wizard's Create button stays busy for the whole flow; the blueprint
  page adds an in-flight guard. Previously a dismissed modal left creation running silently
  with the button re-clickable.
- **Chat double-send** — Enter bypassed the busied Send button; sends are now in-flight
  guarded, and the composer is disabled with a real `<fieldset disabled>` while the server is
  stopped (the old `pointer-events-none` trick let keyboard users send anyway; same fix for
  the world-controls rail).
- **Schedule edits can no longer destroy the schedule** — edit now creates the replacement
  before deleting the original (worst case is a labeled duplicate, never a loss).
- **Toasts rendered behind modal backdrops** (z-50 under z-60) — toasts move to z-65,
  dropdown menus to z-68, and the whole stacking scale is documented in input.css. The
  task-tray panel drops a z-index that was silently capped by the topbar's stacking context.
- **Table truncation that could never engage** — `truncate` inside auto-layout cells let long
  file/mod/backup/world/pack names push actions into horizontal scroll; name columns now use
  `w-full max-w-0` (+ `title`) across files, mods, backups, updates and worlds tables.
- **Handlebars falsy-zero bugs** — `min="0"`, `max`, `step` and zero defaults were silently
  dropped in catalog fields; a new `isDefined` helper fixes constraints and placeholders.
- **Console**: command replies no longer hide below the full-height empty placeholder; the
  empty state clears on first output; filters that hide every line say so; the stream shows a
  visible "disconnected — reconnecting" marker; a leading `/` is stripped to match the
  decorative prompt; command history is deduped.
- **Metrics charts were never themed** — a dead expression left Chart.js's default #666 axes;
  axes/grid/legend now derive from the theme tokens and re-theme on toggle. Reconnects back
  off (a stopped server was polled flat-out every 5s forever) and pause while the tab is
  hidden so gaps aren't drawn as continuous lines.
- **Dashboard live hydration now moves the status dot** — a crashed server used to keep a
  green pulsing "Running" until manual reload (`/api/servers/live` now includes each server's
  status; stale CPU/memory numbers are cleared for stopped servers). The Docker tile shows an
  "Unknown — retrying" state instead of an eternal "Checking…"; the card filter matches
  name/flavor/version/tags instead of the whole card text (typing "cpu" matched every card)
  and shows a "no matches" message.
- **`fmtBytes` floor bug** — three drifted copies all rendered 0 bytes as "1 KB" ("Total:
  1 KB in 0 archives"); one shared `lib/format.js` matches the server-side `bytes` helper.
- **Light-theme-invisible selection** on accent/icon pickers (white ring on white card) —
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

### Changed

- **Chat tab redesigned** (the priority): recipient + mode share one aligned 38px row; the
  17 color swatches and five style toggles are a compact toolbar attached to the message
  input; a live preview line renders the styled message exactly as it lands in-game
  (including a scrambling §k obfuscated preview and a readable glow for dark colors on the
  dark trough); messages get panel-TZ timestamps and sender tooltips; auto-scroll only sticks
  when already at the bottom; long messages wrap. **Chat history is now server-side** —
  recent sends (already recorded as events) render on load, shared across admins, surviving
  reloads.
- **Toast-then-reload is gone from day-to-day flows** — player role toggles, ban/pardon/kick,
  ban-IP add/remove, command prefix saves, test runs and deletes all patch the DOM in place;
  deletes that empty a table restore its empty state instead of leaving orphaned headers.
- **Timestamps honor the panel timezone everywhere** — views emit `data-ts`/`data-ts-ago`
  hydrated through the shared datetime lib (dashboard activity, activity page, backups,
  worlds, schedules — which showed UTC in the table and panel-TZ in the modal for the same
  schedule — settings users, updates, storage, file managers, crash cards).
- **New primitives**: `.notice` (+ ok/warn/danger/info) replaces every ad-hoc callout box;
  `.swatch` (color tiles with a theme-aware gap-ring selected state); `.tile` (wizard
  pickers); `.subtab` (server sub-nav pills); `.meter-indeterminate` (honest sliding-block
  meter replacing all fake `animate-pulse` bars — task tray, wizard, blueprints, worlds,
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
- **Themed scrollbars** everywhere — thin, line-colored, transparent track — replacing the stock
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
  edge + green text), and inactive hover changes text only — a hovered segment can no longer be
  mistaken for the selected one. Converted: wizard source tabs, mod-mode, all three
  Modrinth/CurseForge pickers, dashboard grid/list toggle, chat Tellraw/Say, and both
  teleport-dialog tab rows. Segments are exempt from the global press-down effect (selected tabs
  no longer bounce).
- **Simple/Advanced is now an "Advanced options" switch** in the wizard toolbar — a boolean control
  for a boolean choice — instead of a two-item tab group.
- **Server icons are the official Minecraft sprites** (isometric grass block, creeper head, diamond,
  TNT, chest, diamond sword, potion, end portal frame) from minecraft.wiki, replacing the hand-drawn
  rect-mosaic SVGs. © Mojang, attributed in the README, excluded from the MIT license.
- Tile pickers (loader, server type, icon, accent color — wizard and server Settings) keep a
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
- README: full copy pass — em-dash density cut to ~1 per 320 words, glossary bullets now use colon
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
  panel, dropdowns, modals, toasts, tooltips) now pick a level. Cards drop their shadow entirely —
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
  with the plaintext `rcon.password` — so a nominally read-only account could recover RCON credentials
  and full server contents. The per-server file manager (`/api/servers/:id/files`) and backup download
  (`/api/backups/:id/download`) are now restricted to `admin`/`operator`.
- **Path traversal in the mod content routes is fixed.** `POST /api/servers/:id/mods/toggle` and
  `DELETE /api/servers/:id/mods/:file` passed the `file` name into a single `dataPath()` join, which
  only guarantees containment within `DATA_DIR` — not within the server's own directory. A crafted
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
  compatible with that choice. Results and picks render as a full list — mod icon, name, description,
  downloads — and every selected mod gets its **own version dropdown** so you can pin an exact build.
- **Automatic dependency resolution.** Adding a mod pulls in its **required dependencies** recursively
  (e.g. REI → Architectury API, Cloth Config, Fabric API). Dependencies appear in the list badged
  _"dependency"_ with their own version pickers; you can change a build or remove one, and removals are
  remembered so the resolver won't re-add them. Dependencies with no compatible build are reported, not
  silently dropped.
- **Loader build pinning.** A new service fetches build lists from the Fabric, Quilt, NeoForge and
  Forge registries (cached, best-effort, always offering a "Latest" default), mapped to the matching
  itzg env var (`FABRIC_LOADER_VERSION`, `QUILT_LOADER_VERSION`, `NEOFORGE_VERSION`, `FORGE_VERSION`).
- **One-task modded creation.** "From mods" servers are built by a single server-side task with real
  progress — create (without starting) → install every mod pinned to its chosen build → start — so a
  loader server boots with its mods already present. Individual mod failures are tolerated and reported.

### Changed

- **The "Standard" tab is now "Vanilla."** It covers Vanilla and the plugin flavors (Paper, Purpur);
  the mod loaders moved to "From mods", which is where you pick mods for them.
- **The version picker lists every Mojang channel** — releases, snapshots, betas and alphas — instead
  of releases only, each labelled by channel. (From modpack and From blueprint are unchanged.)
- The compatibility solver is kept as an optional **"Auto-detect from mods"** sub-mode inside From mods
  for when you'd rather have the loader and version chosen from your mod list.

### Notes

- No database schema change was required — loader builds are stored as env vars and pinned mods as
  overlay content, both existing structures. The versioned migration runner already applies any future
  schema changes to your existing `data/panel.db` on startup, so upgrades never assume a fresh database.

## [0.6.2] - 2026-07-15

### Added

- **"Why this over Pterodactyl / Crafty Controller / AMP?"** comparison section in the README.
- **Automated GitHub Releases.** A workflow publishes a tagged Release — with notes pulled straight
  from this changelog — for each new `package.json` version pushed to `main`. It runs on every push
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
  **bold / italic / underline / strikethrough / obfuscated** — laid out as clickable swatches and
  chips. Type, hit Enter, and the message appears in-game and in the panel's chat log (rendered with
  its styling). Targets are validated so entity selectors like `@e[…]` can't be injected.

## [0.5.1] - 2026-07-14

### Fixed

- **Copy buttons now work over plain HTTP (LAN/IP).** The browser's async Clipboard API is only
  available on HTTPS/localhost, so "Copy address" — and the copy-UUID, crash-trace, and
  integration-link buttons — failed with _"Copy failed — select and copy manually"_, and that
  fallback pointed at a `<select>` you couldn't select. Copy now falls back to `execCommand`, and if
  even that is blocked, to a prompt you can copy the value out of by hand.

## [0.5.0] - 2026-07-14

### Added

- **Full control when resetting (re-rolling) a world.** The Reset dialog now lets you keep the current
  seed, roll a **new random** seed, or enter a **custom** seed; optionally switch the **world type**
  (Default / Superflat / Large biomes / Amplified); and choose whether to take a safety backup first —
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
  manifest instead of guessing from the display name — the old guess silently failed for
  renamed/unofficial mods (e.g. "cc tweaked", whose slug is `unofficial-cc-tweaked-…`).
- **Mod installs now match the server's loader — no more a Fabric jar landing on a NeoForge server.**
  For modpack servers (`AUTO_CURSEFORGE` / Modrinth / FTBA) the loader isn't in an env var, so the
  panel had nothing to filter by and installed whichever build came first (often Fabric). It now
  detects the pack's real loader from the manifest mc-image-helper writes (e.g.
  `.neoforge-manifest.json`), so the Modrinth search list, the search **Install** button, and
  add-by-URL all resolve the correct loader's build — or fail with a clear "no build matches" message
  instead of silently installing the wrong one.

## [0.3.0] - 2026-07-14

### Added

- **Create wizard — PvP (and the full gameplay/`server.properties` set) at creation.** The Simple
  "World & rules" step now has a PvP on/off choice (previously reachable only in Advanced mode), and
  Advanced mode exposes every image/`server.properties` setting. Everything chosen here is applied by
  the image at the **first start**, so the server comes up correct with no extra restart.

### Changed

- **The world-controls PvP toggle is now permanent.** It writes the `pvp` value in `server.properties`
  (applies to everyone, including players who join later; takes effect on the next restart) instead of
  the live friendly-fire team shipped in 0.2.0, which only covered players online at toggle time.
  There is no vanilla live+permanent global PvP switch without a server mod/plugin.

### Fixed

- **Containers now run as the panel's own host user (UID/GID) — the root fix for the file `EACCES`
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

- **World controls — live PvP toggle.** Enable/disable PvP on a running server without a restart,
  using a friendly-fire scoreboard team that online players are joined to (teammates can't damage
  each other); re-enabling disbands the team. Covers players online when toggled — re-toggle after
  new joins.
- **World controls — more gamerule quick-toggles.** Mob spawning, fire spread, fall damage, natural
  regeneration, phantoms (insomnia), and instant respawn, alongside the existing keep-inventory,
  day/night cycle, weather cycle, and mob-griefing toggles. All are live over RCON and reflect the
  server's current state.
- **README — "Networking, ports & remote access".** A ports-at-a-glance table (panel / game / RCON /
  Bedrock / BlueMap), how to bind `0.0.0.0`, host + provider firewall guidance, reverse-proxy (TLS)
  and SSH-tunnel options, and a note on the PM2 Node-version pinning gotcha.
- **README — "Status & areas that need work".** Honest, source-verified limitations of the custom
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

Initial public release — a complete, self-hosted control panel for Minecraft servers running on the
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) image.

### Core

- **Multi-server lifecycle** — create / start / stop / restart / recreate / delete, with a graceful
  RCON `stop` before container stop, health-aware status, and crash detection with backoff.
- **Guided wizard** — Simple mode or Advanced mode exposing every supported environment variable with
  plain-English help, grouped by section, plus a raw `KEY=value` escape hatch; only non-default
  values are applied.
- **Pinned modpacks** — "latest" is resolved to a concrete version id and pinned at install time.
  Upgrades are explicit: preview → automatic pre-update backup → graceful stop → re-pin → recreate →
  health monitoring → one-click rollback.
- **Custom-mod overlay** — self-added mods are downloaded into a shared, sha256-deduplicated library
  and hard-linked into the server; they survive pack updates, with class-aware disabling.
- **Console, logs & RCON** — live console over WebSocket, ANSI rendering, search/level filters, a
  command bar with history, and a player list with quick actions; a generated, encrypted RCON
  password is injected per server.
- **Player moderation** — whitelist, ops (levels 1–4), bans, IP bans (RCON while running, direct JSON
  edits while stopped), and teleports by coordinates, to a player, or to the nearest biome/structure.
- **Backups & schedules** — save-safe archive/restore with retention classes and free-space
  preflight; per-server and global cron tasks (restart / backup / RCON) with next-run previews.
- **Blueprints (`.mcserver.zip`)** — portable, secret-stripped recipes of an instance (config,
  resources, pinned pack, mod-overlay manifest, chosen config files, optional embedded world); import
  reproduces the server with fresh ports and hash-verified downloads.
- **Storage analytics & quotas** — a background size-indexer walks `./data`, caches sizes, and
  panel-enforces per-server disk quotas, with usage breakdowns, largest-files, orphan detection, and
  trends.
- **History & crash reports** — every action is a structured event with actor and captured log
  excerpts; crash reports are auto-detected, parsed, and exportable.

### Beyond the basics

- **Live world map** — one-click BlueMap install matched to the server's loader, served through the
  panel's authenticated proxy.
- **Analytics & scoreboard** — vanilla stats ingested on a schedule, per-player profiles, and a
  rankable scoreboard.
- **Activity timeline** — every log line classified (chat, joins, leaves, deaths incl. PvP,
  advancements) into a searchable per-server timeline.
- **Inventory forensics** — read any player's inventory/armor/ender chest from playerdata NBT,
  automatic snapshots on join/death, snapshot diffs, cross-player item search, give/clear via RCON.
- **Investigation** — advisory x-ray suspicion scoring from ore-discovery ratios vs the server median.
- **Discord** — encrypted-webhook notifications with per-event toggles.
- **Invites & client modpacks** — a paste-ready invite block plus a generated client `.mrpack`.
- **Pick-mods-first solver** — choose mods and the solver proposes the newest fully-compatible loader
  and MC version pair.
- **Public status page** — optional unauthenticated `/status/<slug>` per server.

### Security

- Localhost-only by default; auth-mandatory with admin/operator/viewer roles enforced on every
  mutation; `SameSite=Strict` cookies + Origin checks; secrets encrypted at rest (AES-256-GCM);
  path-guarded `./data` access; zip-slip-guarded extraction; SSRF-guarded server-side downloads.
