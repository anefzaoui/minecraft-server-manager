# Updates

[← Back to docs index](README.md)

The **Updates** page tracks what's out of date across your fleet in one place:

- **Modpack** versions ([modpacks](modpacks.md)) against Modrinth / CurseForge / the GTNH release index.
- **Custom content** you added yourself - mods, datapacks, resource packs, plugins - each against its source: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), or GitHub Releases. GitHub lookups use ETag revalidation, so daily checks barely touch its rate limit.
- **Docker image** staleness: each running container's image ID against a freshly pulled tag (deduplicated across servers on the same tag), offered as a recreate-only upgrade.
- **Standalone version pins**: for a server with no managed pack, an explicit `mc_version` pin against Mojang's manifest, and an explicit loader-build env var (`PAPER_BUILD`, `FORGE_VERSION`, and the like) against the loader's registry. Paper builds come from PaperMC's current **Fill v3 API** (the legacy v2 endpoint stopped receiving new Minecraft versions). On a server with mods, a newer Minecraft version is only offered once a [version check](#minecraft-version-compatibility) has shown that every installed mod has a build for it.

![Updates](images/updates.png)

## How it works

The panel checks each server's pinned versions against the upstream source and lists anything with a newer release. A matching count also appears on the [dashboard](dashboard.md)'s "Updates available" tile.

Checks run on demand and can be scheduled ([Schedules](schedules.md)). Update **policy** is per-server: you decide whether the panel just notifies you, or leaves everything manual.

## Minecraft version compatibility

A newer Minecraft version is not an upgrade if your mods cannot come with you. Each server has its own **Versions** tab (under Mods) that answers that question:

- The version the server runs now, and the **highest version every installed mod has a build for**.
- One collapsible row per future Minecraft version, with how many mods are ready and how many have nothing published yet. Open a row to see which mods would be left behind, and which are fine.

![Version compatibility](images/server-versions.png)

Press **Check Future Versions** to run it. Nothing scans on its own: a check reads every jar in the server's mods folder and asks Modrinth and CurseForge about each one, so it only ever happens when you ask. Progress and partial results are written as it goes, so closing the page or refreshing loses nothing, and a check cut short by a panel restart says so and offers to run again. Everything an interrupted check had already worked out is kept, so running it again does not redo that work.

A report only describes the server it was made for. Change the Minecraft version, the loader, or the mods themselves - add one, remove one, update one - and the report is marked out of date and stops being used, until you run the check again.

Mods are identified from the modpack's own file list where there is one, and otherwise by the file's content, the same way a launcher recognises a jar. Two kinds of mod cannot be answered for, and neither is guessed at:

- **Could not be identified** - a hand-built jar or a private build that neither registry recognises.
- **Could not be checked** - a mod from GitHub Releases, Hangar or SpigotMC, or one whose project has been taken down. These publish no list of which Minecraft version each build is for.

While either is installed, the panel will not offer a one-click Minecraft version update at all, because it cannot honestly say what would break. Applying a version above what the mods support is refused, and names the mods blocking it.

Mods you have **disabled** take no part: the server does not load them, so turning a mod off is a real way past a blocker. Turning one on or off marks the report for re-checking.

This covers servers that run mods - Fabric, Forge, NeoForge and Quilt. Paper-style plugin servers keep the plain newest-release behaviour and have no Versions tab, because two of the registries plugins come from publish nothing a check could read.

![A version opened, showing which mods would be left behind](images/server-versions-expanded.png)

Opening a version lists the mods with no build for it first - the ones that decide the answer - and keeps the ready ones behind a click. Big packs load a page of mods at a time, so a 300-mod server opens as fast as a five-mod one.

## Undoing a mod update

Every build a mod is updated from stays in the shared library, so an update that breaks something is reversible. The mod's row on the **Mods** tab gets a **Revert** button that puts the previous build back - no download, so it works even if the project has since been pulled from its registry. The build you reverted away from stops being offered until a newer one appears.

![Revert a mod to the build it was updated from](images/mods-revert.png)

## Applying an update

Updates are never silent. When you choose to upgrade a pack, the panel:

1. Takes a **pre-update backup** (so it's reversible; the last 10 pre-update backups per server are kept).
2. Re-pins the exact new version.
3. Recreates the container, re-resolving the Java runtime if needed.
4. Monitors the first boot, with a per-platform time budget.

If it doesn't come up healthy, you roll back to the pre-update backup. A stable-tracking server is never offered a beta, and the changelog link points at the real per-version diff where the source provides one. A failed update also fires a Discord [alert](integrations.md) if the integration is configured.
