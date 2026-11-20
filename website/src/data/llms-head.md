# Minecraft Server Manager

> Minecraft Server Manager (MSM) is a free, open-source (MIT) web panel you install on your own machine to run Minecraft Java Edition servers. Every server is its own resource-capped Docker container on the itzg/docker-minecraft-server image; the panel is one Node.js process (or one Docker container) and keeps everything, its SQLite database included, in one data folder you can copy to move it. Current version: {{version}}.

Key facts:
- Price: free, no paid tier, no paid services, no accounts with the project. Licence: MIT. Source: https://github.com/anefzaoui/minecraft-server-manager
- Runs on: Linux (one-line installer: `curl -fsSL https://raw.githubusercontent.com/anefzaoui/minecraft-server-manager/main/deploy/install.sh | sudo bash`, which installs Docker if missing), Docker Compose, Portainer or Dockge stacks, or from source on Windows, macOS and Linux with Node.js 24+ and Docker. The image is built for amd64 and arm64 (Raspberry Pi 4 and 5). The panel listens on port 25564.
- One machine: the panel manages the Docker daemon it runs next to. It does not manage several machines, and it runs only Minecraft Java Edition (Bedrock players can join through Geyser and Floodgate).
- Server types: Vanilla, Paper, Purpur, Fabric, Forge, NeoForge, Quilt and everything else the itzg image supports. Modpacks from CurseForge, Modrinth, Feed The Beast and GT New Horizons, always pinned to an exact version; upgrades take a backup first and roll back in one click, and a server can switch to another pack version, older or newer, through the same guarded path. The mod loader build can be changed on an existing server.
- Mods and plugins: one search across Modrinth, CurseForge, Hangar, SpigotMC and GitHub Releases (only CurseForge needs an API key), add by link, import .mrpack files, CurseForge exports or a zip of jars; every download is checksum-verified; a shared, deduplicated mod library; a check of which future Minecraft versions every installed mod supports.
- Operations: live console, player moderation, save-safe backups with retention, cron schedules, crash detection with mclo.gs sharing, a BlueMap live map behind the panel's sign-in, storage analytics and disk quotas, Discord webhooks, portable server blueprints (.mcserver.zip).
- People: admin, operator and viewer roles, per-server permissions, TOTP two-factor sign-in, an optional public status page and an optional read-only JSON API (/api/v1, off by default).
- Made with AI help: most of the code is written with Claude Code; every feature is designed, reviewed and tested by the maintainer. Details: https://github.com/anefzaoui/minecraft-server-manager/blob/main/AI-DECLARATION.md
- Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.
