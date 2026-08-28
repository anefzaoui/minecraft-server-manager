# Creating & managing servers

[← Back to docs index](README.md)

## Creating a server

Click **New server** (top bar) or the **Create a server** card to open the wizard.

![Create a server](images/create-wizard.png)

You choose:

- A **name** (and optional icon, accent color, and tags to organize your fleet).
- A **server type** — vanilla, Paper, Fabric, Forge, NeoForge, and more, each mapped to the right itzg image behind the scenes.
- A **Minecraft version** — `LATEST`, a snapshot, or a specific version.
- **Resources** — RAM (heap), container memory limit, CPU, and a disk quota.

Prefer a modpack? The **From modpack** tab installs a CurseForge, Modrinth, FTB, or GT New Horizons pack instead — see [Modpacks](modpacks.md) — or takes a **custom zip you upload**: a CurseForge modpack export (`manifest.json`) or any zip of mod jars. The manifest (or a majority vote across the identified jars) fills in the loader and Minecraft version, and every mod installs in one task. You can also start from a saved [Blueprint](blueprints.md).

The panel picks a sensible Java runtime for your version automatically, pulls the image, creates the container, and (optionally) starts it — all from the one form.

## The servers list

The **Servers** page lists your whole fleet with status and quick stats.

![Servers list](images/servers-list.png)

## A single server

Opening a server gives you a tabbed workspace:

- **Overview** — status, live stats, uptime, and the primary start / stop / restart controls.
- **Console** — the live log stream and command input, plus in-game chat ([details](console-and-chat.md)).
- **Players** — who's online, plus inventory, analytics, and [chat commands](console-and-chat.md).
- **World** — [worlds, mods, the live map, and the file manager](worlds-and-files.md).
- **Backups** — [snapshots and restore](backups.md) for this server.
- **Insights** — metrics and per-server history.
- **Settings** — everything about how the server runs.

![Server overview](images/server-overview.png)

## Server settings

The **Settings** tab is the full configuration surface: rename, resources, update policy, auto-start / auto-restart, environment variables, and advanced Docker overrides. Fields that change how the container runs are clearly marked as needing a restart.

![Server settings](images/server-settings.png)

> Advanced Docker override fields (custom container name, extra port and bind mounts, and raw overrides) are **admin-only**, because a bind mount plus the panel's Docker access is effectively root on the host. See [Users & roles](users-and-roles.md).
