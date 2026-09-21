# Your Minecraft server will not start

[← Back to docs index](README.md)

Work down this list. It is ordered by how often each one is the answer, and the first four cover most
of them.

## 1. Read the last twenty lines, not the first

Scroll to the **end** of the log. A Java stack trace is printed innermost first, so the top of the
wall of text is the least interesting part. What you want is the last `Caused by:` line and whatever
follows it. That single line usually names the problem.

Two shapes tell you where you are:

- `Exception in thread "main"` or a crash report path near the end means the game itself failed.
- The log simply stopping mid-line, with no exception at all, means something killed the process from
  outside. Jump to point 3.

## 2. UnsupportedClassVersionError means the wrong Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Class file 52 is Java 8, 60 is 16, 61 is 17, 65 is 21. The message means the server needs a newer
Java than it is running on; the reverse, an old pack on new Java, usually fails with a mixin or
reflection error instead.

| Minecraft version  | Java |
| ------------------ | ---- |
| 1.16.5 and earlier | 8    |
| 1.17               | 16   |
| 1.18 and 1.19      | 17   |
| 1.20 to 1.20.4     | 17   |
| 1.20.5 and later   | 21   |

Old packs genuinely need Java 8. Newer is not better here.

## 3. Exit code 137 is the kernel, not a mod

The log stops mid-sentence, there is no crash report, and the container reports 137. That is an
out-of-memory kill: the process asked for memory the machine did not have, so it was terminated.

Almost always the Java heap was set to the same number as the machine's memory. The heap needs the
machine's memory **minus** the JVM's own overhead, which is 0.5 to 1.5 GB on a modded server. Drop
the heap, or raise the machine. [How much RAM a server needs](guide-server-memory.md) has the
numbers.

## 4. The EULA and the port

Two classics with one-line fixes:

- `You need to agree to the EULA in order to run the server.` Set `eula=true`, in `eula.txt` or with
  the environment variable your setup uses.
- `Address already in use` or `FAILED TO BIND TO PORT`. Something else holds 25565, often a previous
  copy of the same server that never fully stopped. Find it and stop it rather than changing the
  port, or you will end up with two.

## 5. A mod is missing its dependency

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric mods overwhelmingly need the Fabric API as a separate file. Forge and NeoForge mods list their
dependencies in the error itself. Install the named version, not the newest one: "requires 0.91.x"
means that line, and 0.92 will fail the same check.

## 6. A mod is for the wrong loader or version

A jar for a different loader does not fail politely. Expect a mixin error, a `NoClassDefFoundError`,
or a crash inside a class you have never heard of. Check the jar's page: the loader and the Minecraft
version both have to match exactly. 1.20.1 and 1.20.4 are different games as far as mods are
concerned.

## 7. The world is from a newer version

```
This world was created by a newer version of Minecraft
```

Worlds upgrade forwards and never backwards. Restore the backup from before the upgrade, or run the
version the world expects. There is no downgrade path that keeps the chunks intact.

## When it crashed after running fine for weeks

Different question, usually a different answer:

- **It crashed under load**, with timings showing long pauses: garbage collection, so look at heap
  size before mods.
- **It crashed at the same point in the world**: a corrupt chunk or a broken entity. The crash report
  usually names coordinates.
- **It crashed right after an update**: the mod that updated is the suspect, even if the trace points
  elsewhere. Roll it back and see.
- **It crashed on restart, having been fine before**: check the disk. A full disk produces spectacular
  and misleading errors.

## Getting help that actually helps

Post the **whole log**, not the last line, and say what you changed before it broke. Paste it
somewhere designed for it, such as [mclo.gs](https://mclo.gs), rather than into chat. Include the
Minecraft version, the loader, the pack and its version, and how much heap the server has. A report
with those four facts gets answered in one reply; without them it takes five.

## In Minecraft Server Manager

Crashes are detected from the container's own exit, so a server that dies at three in the morning is
recorded with its log excerpt rather than found the next day. Crash reports are parsed on arrival:
the exception is highlighted, the stack is collapsible, and mods that appear in the trace are listed
as suspects.

Any report can be shared to mclo.gs in one click when you need help, and the panel keeps the log
bundle so "post the whole log" is a download rather than an archaeology project. An out-of-memory
kill is recorded as an out-of-memory kill, which saves the usual hour of blaming a mod.

Related: [how much RAM a server needs](guide-server-memory.md), [choosing a loader](guide-choosing-a-loader.md),
[creating and managing servers](servers.md).
