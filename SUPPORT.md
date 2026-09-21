# Getting help

MSM is free software and the help around it is free too. This page is about where to ask, what to
expect, and where the line sits between community help and work you would hire someone for.

## Ask the community

- **[Discord](https://discord.gg/Ud6TrQkbDZ)** is the quickest place for "why is my server doing
  this?". There is a support forum, a showcase for your builds, and a dev corner.
- **[Discussions](https://github.com/anefzaoui/minecraft-server-manager/discussions)** suit the
  longer ones: setup advice, "which loader should I pick", ideas that are not bug reports yet. They
  stay searchable, so an answer there helps whoever hits the same wall next month.
- **[Issues](https://github.com/anefzaoui/minecraft-server-manager/issues)** are for reproducible
  bugs and concrete feature requests.

Whichever you pick, these four lines usually turn a five-message thread into a one-message answer:

```text
Panel version:   Settings, bottom of the page
How you run it:  Docker image / from source, and the host OS
Server:          type, loader, Minecraft version, modpack if any
What happened:   what you did, what you expected, what you got
```

Panel logs around the failure help more than anything else. The Files tab has a log bundle download,
and crash reports have a copy button.

Everyone answering is a volunteer, the maintainer included. Nobody is on call, and there is no queue
you can pay to skip. In practice most questions get picked up within a day or two.

## Security problems go somewhere else

Please do not post them in Discord or a public issue. [SECURITY.md](SECURITY.md) has the private
reporting link and what to expect after you send it.

## When it is a job rather than a question

Some things are not really support questions. Moving a 200 GB modded network off another panel,
rescuing a pack that will not boot, or building a community setup from scratch is a piece of work,
and it is one person's time rather than something the community owes you.

If you want that kind of help, say so in the Discord and ask for the maintainer. Typical jobs:

- Installing and hardening MSM on your own server or VPS, TLS and backups included.
- Migrating worlds, mods, and players from Pterodactyl, Crafty Controller, or a hand-rolled setup.
- Untangling a modded pack that crashes, stalls, or eats memory.
- Performance tuning and a backup strategy your moderators can actually operate.

Asking costs nothing, and the answer may well be "you can do this yourself, here is how".

## What paying changes, and what it never will

You can support the project through the Sponsor button at the top of the repository. It goes towards
the domain, the machines MSM is tested on, and the hours behind releases. It is appreciated, and it
is optional.

Here is what neither sponsorship nor paid work will ever buy:

- **Priority.** A sponsor's bug does not jump the queue ahead of anyone else's.
- **Control of the roadmap.** Suggestions are welcome from everybody on equal footing.
- **Features.** Everything MSM can do is in the MIT build and stays there. Nothing moves behind a
  tier, a licence key, or a payment, and security fixes are never gated.

Most of the code in this panel was written by people who volunteered it. Their work is not something
that gets sold, and the free version is not a trial of a better one that exists somewhere else.
