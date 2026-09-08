# Shrinking a world

Over time a world spreads out: every place a player has ever walked, flown, or
been carried by an Ender pearl leaves generated chunks on disk, even if nobody
ever went back. **Shrink world** removes the chunks that almost nobody has spent
time in, so the world takes less space. Minecraft rebuilds a removed area from
the world seed the moment someone travels there again, so this is safe for
land nobody is using - but anything a player _built_ in a spot they barely stood
in would go too, which is why a backup is taken first.

## What counts as "rarely visited"

Every chunk records how long players have spent standing in it (Minecraft calls
this `InhabitedTime`). Shrink world removes any chunk under **30 seconds** of
total player time. The spawn area is always kept.

## Doing it from the Worlds tab

1. **Stop the server.** Shrinking edits the world files directly, so it refuses
   to run while the server is up.
2. Open **World → Worlds**, find the world, and click the shrink icon.
3. Click **Preview** to see roughly how many chunks (and how many megabytes)
   would be removed. Nothing is changed yet.
4. Click **Shrink World**. Progress shows in the task tray.

It's a good idea to take a backup from the **Backups** tab first.

## Doing it as part of a backup

On the **Backups** tab, tick **"Also shrink the world afterwards"** before
**Back Up Now**. The backup archive is written first (that archive is your
undo), then the world is shrunk - but only if the server is stopped. If the
server is running, the backup still runs and the shrink is skipped with a note.

Scheduled backups have the same option: in the schedule editor, choose the
**Backup** task and tick **"Shrink the world after each backup"**. Pair it with
a **Stop server** schedule a few minutes earlier if you want it to run
unattended.
