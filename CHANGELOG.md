# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each push is cut as a new release with
its own dated entry.

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
