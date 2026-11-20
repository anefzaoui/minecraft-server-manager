# Live map

<!-- description: Turn on a BlueMap live 3D map of a server's world in one click, served only through the panel's sign-in. -->

[← Back to docs index](README.md)

A server's **World → Map** tab shows a live, zoomable 3D map of its world, drawn by [BlueMap](https://bluemap.bluecolored.de/) (free and open source), with player positions and every dimension. The panel installs it, configures it and serves it; you never open a port or edit a config file for it.

## Turning it on

1. Open the server, then **World → Map**.
2. Press **Enable Live Map**. The panel installs the BlueMap build that matches the server's loader and Minecraft version from Modrinth, accepts BlueMap's resource download for you, and picks a free port for it.
3. Restart the server (the change applies on the next start, and the server is marked as waiting for one).

BlueMap renders in the background, so a new map takes a few minutes to draw its first tiles. Until then the tab says the map isn't up yet and checks again by itself. Once it is up, **Fullscreen** opens the map in its own browser tab.

It works on servers with a mod loader (Fabric, Quilt, Forge, NeoForge) and on plugin servers (Paper, Purpur and the rest of the Paper family, Spigot), including modpack servers. Vanilla servers have no BlueMap build, and the tab says so.

## Who can see it

The map is served only through the panel, behind its sign-in: anyone who can view the server in the panel can open its map, and nobody else. BlueMap's own port is never meant to be opened to the internet ([ports at a glance](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Turning the map on or off needs the server's **Settings** permission ([users & roles](users-and-roles.md#per-server-permissions)).

When the panel itself runs in Docker it reaches BlueMap inside the server's container; the [README](https://github.com/anefzaoui/minecraft-server-manager#installation) explains the details for reverse-proxy setups.

## Turning it off

**Disable Map** removes the BlueMap jar the panel installed and frees its port, again from the next restart. The world itself is untouched; rendered map tiles stay in the server's folder until you delete them on the **Files** tab.

Related: [worlds & files](worlds-and-files.md), [invites & status page](invites-and-status-page.md).
