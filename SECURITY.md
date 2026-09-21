# Security

MSM talks to the Docker daemon, holds the credentials for your servers, and can read and write
anything under its data directory. A bug in it can be worth a lot more than a crash, so security
reports are welcome and taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:

> [Report a vulnerability](https://github.com/anefzaoui/minecraft-server-manager/security/advisories/new)

That form is private between you and the maintainers until a fix ships. If you cannot use it, say
hello in the [Discord](https://discord.gg/Ud6TrQkbDZ) and ask for a private channel, without posting
the details publicly.

Useful things to include, as far as you have them:

- What an attacker gets, and what access they need to start (unauthenticated, viewer account, LAN).
- The panel version, from Settings, and how you run it (Docker image or from source).
- Steps or a short script that shows the problem.
- Any log lines the panel printed at the time.

You do not need a working exploit. A clear description of the flaw is plenty.

## What happens next

- **Within a few days**, an acknowledgement that the report arrived and was understood.
- **Then**, an assessment: whether it reproduces, how serious it looks, and a rough timeline.
- **When a fix is ready**, a release, a note in the changelog, and credit to you by name or handle if
  you want it. If you would rather stay anonymous, that is fine too.

If a report turns out to be a configuration problem rather than a flaw in MSM, you will get an answer
explaining why, not silence.

## Supported versions

Fixes land on the latest release. MSM is young and moves quickly, so there are no long-term support
branches yet: upgrading to the newest version is the supported path.

## Things that are already known

These are properties of the design rather than bugs, and they are documented in the README:

- **MSM needs the Docker socket.** Anyone who can use the panel as an admin can effectively run
  commands as root on the host. Treat panel admin access the same way you treat SSH access.
- **The panel speaks plain HTTP by itself.** Put it behind a reverse proxy with TLS before exposing
  it beyond your own network, and set `COOKIE_SECURE`.
- **BlueMap's own web server binds to every interface.** Reach a live map through the panel's
  authenticated proxy and keep that port closed at the firewall.

Reports that amount to "an admin can do admin things" or "the panel is insecure if you publish it on
the internet without TLS" will be closed with a pointer to this list.
