# Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: which one?

[← Back to docs index](README.md)

Pick by what you want players to install, not by what sounds fastest.

| You want                                           | Run this           | Players install |
| -------------------------------------------------- | ------------------ | --------------- |
| Survival with friends, nothing unusual             | Vanilla            | Nothing         |
| A public server with ranks, claims, and moderation | Paper              | Nothing         |
| A specific mod pack from CurseForge or Modrinth    | Whatever it says   | The pack        |
| A modern mod pack you are building yourself        | Fabric or NeoForge | The same mods   |
| An old pack from the 1.7 to 1.12 era               | Forge              | The same mods   |

That is the whole decision for most people. The rest of this page is why.

## Plugins and mods are not the same thing

This is the distinction everything else hangs off.

**Plugins** run only on the server. Paper, Spigot and Bukkit load them. Players join with an ordinary
unmodified client and never know. Anything that is fundamentally about rules, permissions, economies,
claims, minigames, or moderation is a plugin, and that is why nearly every public server runs Paper.

**Mods** change the game itself: new blocks, new dimensions, new machines. The client has to load the
same mods as the server, or it cannot understand what the server is telling it. Anyone joining a
modded server installs the pack first.

A server cannot meaningfully be both. Hybrid projects exist that bolt a plugin API onto a mod loader,
and they work until they do not, usually at the worst moment. If you need both, run a proxy with a
modded server and a plugin server behind it rather than one hybrid.

## The plugin side

**Paper** is the default answer. It is a fork of Spigot with years of performance work and a
configuration file for nearly every behaviour that has ever annoyed an administrator. Vanilla plugins
from the Bukkit era mostly still run.

**Purpur** is a fork of Paper with even more knobs, including gameplay ones. Take it if you want
those specific switches; otherwise Paper.

**Vanilla** is worth running when the point is the unchanged game. It is slower with many players,
and it has no permission system, so moderation is manual.

Paper changes some vanilla behaviour by default in the name of performance. If a redstone contraption
from a video does not work on your server, that is usually why, and it is usually a setting.

## The mod side

**Fabric** is small, updates to a new Minecraft version within days, and carries most modern
performance mods. Nearly every Fabric mod also wants the Fabric API, which is a separate download.
If your goal is a fast server with a handful of quality-of-life mods, this is the one.

**NeoForge** is where the old Forge ecosystem now does its work for current versions. It split from
Forge during 1.20.1, and most large packs built for 1.20.2 and later target it. If you are starting a
new heavyweight pack today, this is the one.

**Forge** still owns the past. Anything from the 1.7.10, 1.12.2 and 1.16.5 eras, which is a great deal
of the beloved packs, is Forge and always will be. Keep it for those.

**Quilt** is a fork of Fabric that runs most Fabric mods. It exists for good reasons, but if you have
no specific reason to choose it, choose Fabric.

Mods for one loader do not run on another. A mod page that says Fabric means Fabric.

## If you are installing a pack, the pack decides

Do not choose. The pack lists its loader and its exact Minecraft version, and both have to match.
"Close enough" is not a thing here: a pack for 1.20.1 does not run on 1.20.4, and a 1.20.1 NeoForge
pack does not run on 1.20.1 Forge.

Install the pack by its ID or link rather than by hand-picking mods, and pin the version. Packs
update, and an update that lands under your feet mid-season is how worlds get corrupted.

## Which Java version

Minecraft's requirement moves with the game, and running the wrong one produces an unhelpful
`UnsupportedClassVersionError` rather than a clear message.

| Minecraft version  | Java |
| ------------------ | ---- |
| 1.16.5 and earlier | 8    |
| 1.17               | 16   |
| 1.18 and 1.19      | 17   |
| 1.20 to 1.20.4     | 17   |
| 1.20.5 and later   | 21   |

Forge-family servers on 1.20 want Java 21 across that whole line. Old packs really do need Java 8;
this is one of the few places in software where the newest version is wrong.

## In Minecraft Server Manager

The creation wizard asks what you want to run and picks the Java version from the table above, so the
mismatch never happens by accident. Installing a pack from CurseForge, Modrinth, FTB or GT New
Horizons pins it to an exact version, and upgrading is an explicit action that takes a backup first
and can be rolled back.

The mod browser knows which loader a server runs and filters what it offers accordingly, so a Fabric
jar cannot land in a NeoForge server by mistake.

Related: [creating and managing servers](servers.md), [modpacks](modpacks.md),
[how much RAM a server needs](guide-server-memory.md).
