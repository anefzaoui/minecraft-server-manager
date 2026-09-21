# How much RAM does a Minecraft server need?

[← Back to docs index](README.md)

Short answer, for a server that will actually be played on:

| What you are running                       | Java heap  | Give the machine |
| ------------------------------------------ | ---------- | ---------------- |
| Vanilla or Paper, up to 10 players         | 2 GB       | 4 GB             |
| Paper with plugins, 10 to 30 players       | 4 GB       | 6 GB             |
| A light mod pack, 40 to 80 mods            | 4 GB       | 6 GB             |
| A big kitchen-sink pack, 150 to 300 mods   | 6 to 8 GB  | 10 GB            |
| GregTech New Horizons and similar monsters | 8 to 12 GB | 16 GB            |

Two numbers, not one. That is the part most guides skip, and it is the reason people buy a 4 GB
server, give Java 4 GB, and then watch it die.

## The heap and the machine are different numbers

The Java heap (`-Xmx`) is how much memory the game itself may use for the world, entities, and mod
data. The machine, or the container, has to hold that heap **plus** everything else Java needs:
class metadata, thread stacks, garbage-collector bookkeeping, network buffers, and the JVM itself.
That overhead is roughly 0.5 to 1.5 GB for a modded server.

If the heap equals the machine's memory, the kernel kills the server the moment Java reaches for
that overhead. In Docker that shows up as exit code 137, and in the logs as nothing at all: the
process simply vanishes mid-sentence. People usually blame a mod.

A safe rule: **heap plus 25 percent, and at least one spare gigabyte.** An 8 GB heap wants a 10 GB
machine.

## More RAM is not more performance

Minecraft is single-thread bound in most of what it does. Giving a 40-mod pack 16 GB does not make
chunks generate faster; it makes each garbage collection pause longer, because there is more to
walk. A server that stutters every thirty seconds is often a server with too much heap, not too
little.

Raise the heap when you see these, and not otherwise:

- `java.lang.OutOfMemoryError: Java heap space` in the log.
- Repeated "Can't keep up! Is the server overloaded?" with garbage-collection pauses in the timings.
- Memory use that climbs to the ceiling and stays pinned there for hours.

## Why your server shows 12 GB used while nobody is online

Because you told it to. Two defaults conspire:

1. The common Docker image sets the starting heap equal to the maximum, so `-Xms` and `-Xmx` are
   both your number. Java claims it up front rather than growing into it.
2. The popular Aikar flag set includes `-XX:+AlwaysPreTouch`, which walks every page of that heap at
   startup so the pages are really allocated. It is deliberate: it trades a slower boot and a fat
   idle figure for fewer pauses later.

Measured on Paper 1.21.1 with a 2 GB heap in a 4 GB container, sampled for three minutes after the
world finished loading:

| Configuration                           | Resident memory |
| --------------------------------------- | --------------- |
| No flags                                | 2.60 GiB        |
| Aikar flags                             | 2.59 GiB        |
| Aikar flags without `AlwaysPreTouch`    | 1.95 GiB        |
| Aikar flags with a 512 MB starting heap | 1.38 GiB        |
| No flags with a 512 MB starting heap    | 1.25 GiB        |

So a server "using" 12 GB at idle is usually a 12 GB heap that has been pre-touched, not a leak.
Your monitoring is reading it correctly; the number just does not mean what it looks like.

If you want an honest idle figure, set the starting heap lower than the maximum. You pay for it with
a few more collections early on. If you would rather have flat frame times, leave it alone and stop
watching the graph.

## Players matter less than you think

Doubling from 10 to 20 players costs far less than adding fifty mods. Players mostly add entities
and loaded chunks, which scale gently. Mods add class data, registries, world-generation features,
and their own caches, which do not. Size for the pack first, then add roughly 100 to 200 MB per
regular player on a modded server.

View distance is the other big lever. Dropping from 12 to 8 chunks can save a gigabyte on a busy
server and is barely noticeable in play.

## In Minecraft Server Manager

Each server has two separate fields, **Java heap** and **container memory limit**, precisely because
they are different questions. The panel refuses to save a server whose container limit is not above
its heap, because that combination ends in exit code 137 rather than an error message.

The memory meter on a server shows what the container is really using, with a note when the heap was
claimed up front, so a pre-touched heap does not read as a runaway. A server that the kernel killed
for memory is recorded as exactly that in the history, rather than as a mystery crash.

Related: [creating and managing servers](servers.md),
[crash reports](servers.md#crash-reports--mclogs-analysis), [storage and quotas](storage.md).
