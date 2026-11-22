# Roadmap

What's done in Minecraft Server Manager, what's being worked on, and what's been asked for. Each item links to its
issue or pull request, where the details and the discussion are. Released changes are described in
[CHANGELOG.md](CHANGELOG.md), and the known rough edges of features that already ship are in the README's
[Status & areas that need work](README.md#status--areas-that-need-work). Bug reports and ideas are welcome in
[Issues](https://github.com/anefzaoui/minecraft-server-manager/issues), questions in
[Discussions](https://github.com/anefzaoui/minecraft-server-manager/discussions).

This page reports status only. An item under "Asked for" is an open request, not a promise: it ships when a pull
request for it is reviewed, verified on a real panel and merged.

✅ done · 🔄 being worked on · 📋 asked for · 🔍 looking into it

## Released

The full notes for each release are in [CHANGELOG.md](CHANGELOG.md).

- ✅ **0.15.0**: change a server's game port, mod loader build and modpack version after it was created; backup
  retention in the panel; mod config editing; console autocomplete; a settings save changes only what was changed; the
  one-line installer works ([#64](https://github.com/anefzaoui/minecraft-server-manager/issues/64),
  [#69](https://github.com/anefzaoui/minecraft-server-manager/issues/69),
  [#92](https://github.com/anefzaoui/minecraft-server-manager/issues/92),
  [#93](https://github.com/anefzaoui/minecraft-server-manager/issues/93),
  [#113](https://github.com/anefzaoui/minecraft-server-manager/issues/113))
- ✅ **0.14.1**: a newer Minecraft version is offered only when every mod has a build for it; the Versions tab; undo a
  mod update ([#52](https://github.com/anefzaoui/minecraft-server-manager/issues/52))
- ✅ **0.14.0**: per-server permissions for operators and viewers, down to hiding a server entirely
  ([#43](https://github.com/anefzaoui/minecraft-server-manager/issues/43))
- ✅ **0.13.2**: settings changed in the panel survive a restart; creating a server from a modpack works again
  ([#39](https://github.com/anefzaoui/minecraft-server-manager/issues/39))
- ✅ **0.13.1**: the Settings dialogs work again; the memory meter explains a heap given up front
  ([#37](https://github.com/anefzaoui/minecraft-server-manager/issues/37),
  [#25](https://github.com/anefzaoui/minecraft-server-manager/issues/25))
- ✅ **0.13.0**: a public read-only API, live monitoring, world shrinking, ignoring an update, defaults for new servers,
  backup renaming, a mobile pass over every page
- ✅ **0.12.0**: update safety: no unpinned modpack updates, and an update policy that does what it says
  ([#22](https://github.com/anefzaoui/minecraft-server-manager/issues/22),
  [#24](https://github.com/anefzaoui/minecraft-server-manager/issues/24))
- ✅ **0.11.0**: content sources: Hangar, SpigotMC and GitHub Releases, `.mrpack` import, checksum-verified downloads,
  mclo.gs crash analysis
- ✅ **0.10.0**: structured logging, rate limiting, a dedicated encryption key, automatic daily backups, health
  endpoints, datapacks and zip imports on the Mods tab
- ✅ **0.9.x**: the panel as a Docker container with a multi-arch image
  ([#1](https://github.com/anefzaoui/minecraft-server-manager/issues/1)), Advanced Docker Settings, GT New Horizons,
  two-factor sign-in, fixes for schedules, time zones, the live map and Bedrock players
- ✅ **0.1.0 to 0.8.0**: the first public release (servers, modpacks, console, players, backups, schedules, blueprints,
  the live map, the status page) and the UI overhaul

## Being worked on

### Bugs

- 🔍 Boot recovery can delete the pre-restore world when a cross-device restore died during the copy
  ([#100](https://github.com/anefzaoui/minecraft-server-manager/issues/100))
- 🔍 Servers disappear after the container restarts on one NAS setup; looks like the data folder isn't kept there
  ([#58](https://github.com/anefzaoui/minecraft-server-manager/issues/58))
- 🔍 Loader build pins survive Minecraft version changes made outside the Updates page
  ([#61](https://github.com/anefzaoui/minecraft-server-manager/issues/61))
- 🔍 Tests: a request to the in-process test server is reset under heavy load on Linux
  ([#102](https://github.com/anefzaoui/minecraft-server-manager/issues/102))
- 🔍 Tests on Windows leave temporary folders behind
  ([#103](https://github.com/anefzaoui/minecraft-server-manager/issues/103))
- 🔍 A migration test writes into the real migrations folder
  ([#63](https://github.com/anefzaoui/minecraft-server-manager/issues/63))
- 📋 Move the Minecraft version and loader build upgrade into a service
  ([#62](https://github.com/anefzaoui/minecraft-server-manager/issues/62))

### Pull requests in review

Contributions waiting for review. Each is reviewed line by line and run on a real panel before it can merge.

- 🔄 Rootless Podman support ([#97](https://github.com/anefzaoui/minecraft-server-manager/pull/97))
- 🔄 Interface translations ([#66](https://github.com/anefzaoui/minecraft-server-manager/pull/66))
- 🔄 Native Bedrock runtime ([#65](https://github.com/anefzaoui/minecraft-server-manager/pull/65), see
  [#19](https://github.com/anefzaoui/minecraft-server-manager/issues/19))
- 🔄 Software and version changes on the Overview, with a downgrade guard
  ([#55](https://github.com/anefzaoui/minecraft-server-manager/pull/55))
- 🔄 A series from one contributor (#73 to #89): backup verification and skipping backups of stopped servers, a Health
  page with crash details, a task tray for slow operations, fleet-wide schedules, more `/api/v1` routes, loader-aware
  version offers, watcher fixes, performance work, mobile layout, dependency and CI updates, more tests, and fixes from
  a full review ([open pull requests](https://github.com/anefzaoui/minecraft-server-manager/pulls))

## Asked for

- 📋 More control over backups, including turning scheduled backups off
  ([#90](https://github.com/anefzaoui/minecraft-server-manager/issues/90)); per-kind retention landed in #68
- 📋 A crash report list that stays short: a table, old reports out of the way
  ([#91](https://github.com/anefzaoui/minecraft-server-manager/issues/91))

## Looking into it

- 🔍 What Bedrock Edition support would actually take: research only, nothing committed
  ([#19](https://github.com/anefzaoui/minecraft-server-manager/issues/19))
