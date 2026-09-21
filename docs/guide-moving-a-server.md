# Moving a Minecraft server to another host

[← Back to docs index](README.md)

Moving a world is easy. Moving a server that players can still log into, with their inventories, homes
and permissions intact, is the part that goes wrong. The order below keeps the downtime to a few
minutes and keeps a way back if the new machine disappoints.

## Take stock first

Write these down before you touch anything. Every one of them has ended a migration badly when it was
assumed rather than checked:

- **Minecraft version and loader**, exactly. 1.20.1 NeoForge is not 1.20.1 Forge.
- **The mod or plugin list with versions.** The world will not load without the mods that made it.
- **Java version**, which follows the Minecraft version.
- **`level-name`** from `server.properties`. The world folder is often not called `world`.
- **Online mode.** If the old server ran with `online-mode=false` and the new one runs with it on, or
  the reverse, every player gets a different UUID and therefore a brand new, empty inventory. This is
  the single most painful mistake on this page.
- **Anything living outside the server folder**, such as a plugin's MySQL database.

## Copy while it runs, then copy again while it is stopped

The trick to short downtime is doing the slow copy first.

1. **With the server running**, copy the whole server directory to the new machine. On a large world
   this may take an hour; nobody notices, because nothing has stopped.
2. **Announce a restart, then stop the server properly.** A graceful stop makes the game flush the
   world; killing the process does not.
3. **Copy again.** Only the files that changed move this time, so it takes seconds to minutes.
4. **Start it on the new machine**, on a non-public port if you can, and join it yourself. Check a
   base you know, your own inventory, and that plugins or mods loaded without errors.
5. **Then** point players at it.

`rsync -a --delete` is the usual tool for steps 1 and 3. Keep permissions and timestamps: a world
copied as the wrong user is a server that will not start, and the error will not say so clearly.

## Do not delete the old one yet

Keep the old machine, stopped but intact, for at least a few days. It is the only real rollback. Keep
it powered off rather than running, so nobody accidentally joins the abandoned copy and builds there
for a week.

## Make the address survive the move

If players connect to a bare IP address, every move forces every player to edit their server list, and
some of them never do.

Use a hostname you control, pointed at the server. Moving then becomes a DNS change, and the address
in everyone's client stays the same. Lower the record's time-to-live a day before the move so the
change propagates quickly.

If you want players to type a bare domain while the server runs on a non-standard port, an SRV record
does that. It is the same mechanism commercial hosts use to hand out `play.something.net`.

## Check the new machine before trusting it

Three things that differ between hosts and bite after the move:

- **The firewall.** Your game port has to be open, and only your game port. Do not expose a management
  panel or a map to the internet just because it worked on localhost.
- **Single-core speed.** Minecraft cares far more about how fast one core is than how many there are.
  Eight slow cores will feel worse than two fast ones.
- **Disk.** A world on spinning storage or a heavily shared volume will stutter during chunk loading.

## Leaving a managed panel

If you are coming from a host that gave you a control panel rather than a machine, find the download
or file manager, and take the entire server directory rather than just the world. Get the plugin and
mod jars themselves, not a list: the versions matter, and "latest" is a different file next month.

Check your backups are yours, too. A backup that only exists inside the panel you are leaving is not
a backup you own.

## In Minecraft Server Manager

The whole panel is one directory. Copying it to another machine and starting the panel there brings
every server, world, backup and setting with it, which makes moving the panel itself a copy rather
than a migration.

For one server rather than all of them, a blueprint captures its configuration, mod set and pinned
pack version as a single `.mcserver.zip` that can be imported on another panel to rebuild the same
server. Worlds can be exported and installed separately when only the world needs to travel.

Related: [blueprints](blueprints.md), [backups that actually restore](guide-backups.md),
[worlds and files](worlds-and-files.md).
