---
version: '0.1.2'
level: copilot
processes:
  design: assist
  implementation: copilot
  testing: copilot
  documentation: copilot
  review: assist
  deployment: copilot
---

This format is based on [AI-DECLARATION.md](https://ai-declaration.md/en/0.1.2/).

# How MSM is made, and where AI comes in

Short version: most of MSM's code is written by AI, and I want that to be easy to find rather than
something you discover in the commit log. I'm Ahmed, the maintainer. I started MSM to run the
Minecraft servers I host for my partner and friends, and I still run it for them every day.

## Which AI

[Claude Code](https://claude.com/claude-code), Anthropic's coding tool, running Anthropic's Claude
models. Commits made with it carry a `Co-Authored-By: Claude ...` line that names the model, so
`git log` shows exactly which changes it touched.

## How it's used

I design the panel and every feature in it. I decide what MSM does and how it should feel, write the
spec for each change, and Claude Code writes most of the code from that spec: the server, the pages,
the tests, the docs and the CI. I read and review the changes before they land, and I test every
release on the servers I run for my partner and friends before it goes out. If something doesn't
work on a real server, it doesn't ship.

`main` is protected, so nothing goes in without a pull request and a green CI run, AI-written or not.

## Disclosure by area

The categories and levels below are the ones the
[selfhosted community on lemmy.world](https://lemmy.world/post/49151085) asks for, so you can compare
MSM with other projects. The levels in the header at the top of this file use the
[AI-DECLARATION.md](https://ai-declaration.md/en/0.1.2/) names for the same thing.

- Design (architecture, system design): Assisted. The features, the panel's layout and how things
  should behave come from me. Claude proposes how to build parts of it, and I pick or change the plan.
- Implementation (production code): Generated. Most of the code is written by Claude from my specs,
  then reviewed and tested by me.
- Testing (tests, test plans, QA): Generated for the automated tests, human for the hands-on QA. Claude
  writes most of the tests. I do the real-world testing on live servers before each release.
- Documentation (docs, comments, README, changelog): Generated. Claude drafts most of it, and I edit
  what doesn't sound right or isn't true to how the panel works.
- Review (code review, PR feedback): Assisted. I review every change and decide what merges. Claude
  helps read through changes and outside PRs, but the call is mine.
- Deployment (CI/CD): Generated. The GitHub Actions workflows, the Dockerfile and the deploy scripts
  were mostly written by Claude, and I check that they do what they should.

## People who helped

Not everything here came out of a prompt. These people sent pull requests that are in MSM today, and
I'm really thankful for every one of them:

- [doubleangels](https://github.com/doubleangels): TOTP two-factor login (#7), security fixes for
  symlink escapes, chat-command nesting and SSRF (#6), the Paper 26.2 startup status fix (#5), a lot of
  UI polish, reliability and security hardening (#14, #35), settings that persist across restarts
  (#40), and more PRs in review right now.
- [pharomwinters](https://github.com/pharomwinters): GT New Horizons as a first-class modpack platform,
  with per-version Java selection (#4).
- [OwenWright8](https://github.com/OwenWright8): Advanced Docker Settings and the editable YAML
  preview (#3).
- [gleep52](https://github.com/gleep52): the per-server OpenAI-compatible chatbot (#13).
- [tomas-pecserke](https://github.com/tomas-pecserke): pinned selectors being ignored when creating a
  server from a modpack (#41).

Contributors use their own tools. Some outside PRs were written with AI help as well, and their
commits say so the same way, with a `Co-Authored-By` line. Plenty of people also helped without
writing code, with bug reports and ideas that shipped. They're credited in the README.

## Tests

The automated tests live in [`test/`](test/) and run with Node's built-in test runner (`pnpm test`).
They don't need Docker. CI runs them on every pull request, together with lint, formatting, type
checks, the build and a Docker image build, and a PR can't merge until all of that passes. There are
also install scenario scripts in [`test/deploy/`](test/deploy/) and a live sweep against a running
panel (`pnpm run test:smoke`).

Tests catch a lot but not everything, which is why every release also gets tried by hand on real
servers first.

## Security

Please read this part even if you skip the rest. MSM needs the Docker socket to manage your servers,
and access to the Docker socket is root-equivalent on the host. Anyone with admin access to the
panel can effectively run commands as root on that machine.

So keep the panel on your LAN, behind a VPN, or behind a reverse proxy with TLS, and treat the admin
login like SSH access. Don't put it on the open internet as is. The [Security](README.md#security)
section of the README and [SECURITY.md](SECURITY.md) have the details.

AI-written code can look right and still be wrong, so I'd rather hear about a suspicious bit of code
than have someone quietly assume it's fine.

## Found a problem?

- Bugs and feature requests: [GitHub issues](https://github.com/anefzaoui/minecraft-server-manager/issues).
- Questions and help: the [Discord](https://discord.gg/Ud6TrQkbDZ) or
  [Discussions](https://github.com/anefzaoui/minecraft-server-manager/discussions).
- Security problems: please don't post them publicly. Use the private
  [vulnerability report](https://github.com/anefzaoui/minecraft-server-manager/security/advisories/new)
  form, see [SECURITY.md](SECURITY.md).

If you have thoughts on how AI is used here, an issue or a Discussion is welcome too :)

## Notes

- This file covers the project as a whole. It will be updated if the way AI is used here changes.
- The model names change over time. The `Co-Authored-By` lines in the commits are the exact record.
