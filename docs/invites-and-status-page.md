# Invites & status page

<!-- description: Invite friends to a server with the address, version and a client modpack, and share a public status page that shows only what you choose. -->

[← Back to docs index](README.md)

Two tabs under a server's **Settings** group help players find and join it: **Invites** writes everything a friend needs to connect, and **Status Page** publishes a small public page that shows whether the server is up. Both need the server's **Settings** permission ([users & roles](users-and-roles.md#per-server-permissions)).

## Invites

**Settings → Invites** has an **Invite Friends** card:

- **Address to share** lists the machine's addresses on your local network with the server's game port, your public address when the panel could detect it (players outside your network reach it only through port forwarding), and **Custom address…** for a domain or address you set up yourself, such as `play.example.com:25565`.
- **Invite text** is a ready-to-paste message with the server's name, the address you picked, and its Minecraft version and type. **Copy Invite Text** puts it on the clipboard. When the whitelist is on, the text asks friends for their Minecraft username, and the card reminds you to add each friend on the **Players** tab before they join.
- **What friends need** says what goes on the player's side: nothing but the right Minecraft version for a vanilla or plugin server (Paper and the like), or the server's mods for a modded one.

### The client modpack

On a modded server the card also offers **Download Client Modpack (.mrpack)**. Friends import it into Prism Launcher or the Modrinth App, which installs the server's Minecraft version and mod loader, downloads the mods, and adds the server to their multiplayer list with the address you picked.

The file is built from the mods you added to the server yourself (the custom-mod overlay) that come from Modrinth. Mods from elsewhere are listed on the card instead, so friends can add those files to their `mods` folder by hand. On a server created from a modpack, friends should install that pack, at the version the server runs, in their launcher; the **Overview** tab shows the version.

### Playing over the internet

**Playing over the internet (port forwarding)** at the bottom of the card explains the router side: forward the server's game port (TCP and UDP) to the machine that runs the panel, then share your public address with the port. If your internet provider uses CGNAT, port forwarding cannot work, and a tunnel service (for example playit.gg) is the way in. The panel does not open router ports by itself. Only game ports belong on the internet; keep the panel's own port and the RCON ports closed ([ports at a glance](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Status page

**Settings → Status Page** turns on a public page for one server, off by default:

1. Switch the card on.
2. Choose the **Page address**: the page lives at `/status/<address>` on your panel, and the address is 3 to 40 lowercase letters, numbers or dashes, unique across your servers.
3. Press **Save**. **Open Page** and **Copy Link** then give you the link to share.

Anyone with the link sees the server's name, its MOTD, version, whether it is running, the player count and its uptime, and nothing else. The page has no link into the panel and needs no sign-in. It reads the panel's in-memory status, so visitors never cause work on the Docker daemon.

Turning the page off keeps its address, so switching it back on restores the same link. For a page or a bot of your own, the [public API](public-api.md) returns the same kind of status as JSON.

Related: [Discord notifications](integrations.md), [the live map](live-map.md), [creating and managing servers](servers.md).
