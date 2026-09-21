# Minecraft server backups that actually restore

[← Back to docs index](README.md)

Most servers have backups. Rather fewer have backups that work, and the difference is only ever
discovered on the worst day. Three things separate them: the copy is consistent, it lives somewhere
else, and somebody has restored it at least once.

## Copy the world while it is not being written

A running server writes region files continuously. Copy them mid-write and you get a file that is
half old and half new, which either fails to load or loads with a hole in the ground where somebody's
base used to be. Nothing warns you, because the copy succeeded.

There are two correct ways to take a copy:

1. **Stop the server**, copy, start it again. Simple, honest, and unpopular because of the downtime.
2. **Tell the game to stop writing first.** Run `save-off`, then `save-all flush`, wait for it to
   finish, copy, then `save-on`. The world is complete and quiet for the duration of the copy.

Never skip straight to the copy. A snapshot at the filesystem or volume level is fine only if it is
genuinely atomic, and a `cp -r` while players are placing blocks is not.

## Back up more than the world

Restoring the world alone gets you the terrain and loses the server. You also want:

- `server.properties`, and whatever else sets the rules.
- The mod or plugin jars, at the exact versions that were running. A world will not load without the
  mods that created its blocks.
- Player data, including `whitelist.json`, `ops.json` and the stats and advancements folders.
- The pack version, if it came from a pack. Writing it down counts.

The quickest sanity check on any backup: could you rebuild this server on a fresh machine from the
archive alone? If the answer needs a sentence starting with "and then I would reinstall", it is not a
complete backup.

## One copy on the same disk is not a backup

A backup that lives on the machine it protects covers exactly one failure: you deleted something.
It does not cover the disk dying, the provider suspending the account, or a mistake that deletes the
whole directory.

Keep it simple rather than perfect:

- One local copy, for the common case, which is somebody griefing or a bad update.
- One copy somewhere else. Another machine, an object store, or a home NAS pulling nightly over SSH.
- Enough history to survive a problem you did not notice immediately. Corruption is often found days
  later, and if you keep three days of backups you have already overwritten the good one.

Seven daily copies plus four weekly ones covers nearly every real incident and costs very little
space.

## Test a restore before you need one

Pick a backup, restore it into a spare server, and join. That is the entire test, it takes fifteen
minutes, and it catches all of the classic failures: the archive missing the mods folder, a world
that needs a version you no longer run, permissions that make the files unreadable, a truncated
upload.

Do it once when you set the backups up, and once more after any big change to the server.

## Size, and how to keep it sane

Worlds grow because players explore. A world where somebody flew ten thousand blocks in a straight
line carries every chunk along that line forever, and most of those chunks will never be visited
again.

Three levers, in order of how much they give back:

1. **Trim unvisited chunks.** Tools that prune by last-touched time typically remove a large fraction
   of a well-travelled world with no visible effect in play.
2. **Compress properly.** Region files compress well; archives of them do not benefit from anything
   exotic.
3. **Do not keep every hourly copy for a year.** Retention beats compression.

## In Minecraft Server Manager

Backups take the `save-off`, flush, copy, `save-on` path, and a graceful stop that lands mid-backup
waits for the copy to finish rather than racing it. The archive covers the whole server directory, so
mods, configuration and player data travel with the world.

Backups can run on a schedule alongside restarts and commands. Retention counts each kind separately,
so the ten scheduled copies that pile up on their own cannot push out the one you took by hand before
a risky change, and age and size caps apply on top. Restoring takes a fresh backup first, so a restore
to the wrong point in time is itself undoable. A world can be shrunk on its own or as part of a backup, which is the lever
that matters most for size.

The whole panel, including every backup, lives under one directory. Copying that directory elsewhere
is the off-machine half of the story, and it is deliberately the only thing you have to copy.

Related: [backups in the panel](backups.md), [schedules](schedules.md),
[shrinking a world](world-shrink.md), [moving a server to another host](guide-moving-a-server.md).
