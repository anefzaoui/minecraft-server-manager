---
name: verify
description: How to verify a change to Minecraft Server Manager for real before it's called done or merged - the CI gates, a throwaway panel with its own data folder and ports, real servers in Docker, the pages in a real browser as more than one user, screenshots, and cleaning up. Use before every commit you call finished, before opening or merging a PR, and in every agent brief ("follow the verify skill").
---

# Verify a change to MSM

Unit tests aren't proof that a feature works. A change is verified when it ran the way a server
owner runs it: a real panel, real Minecraft servers in Docker, the page in a real browser, as the
roles it touches. The evidence (commands, log lines, screenshots) goes in the PR. Check what the
diff touches against [REVIEW.md](../../../REVIEW.md) as well.

## 0. Isolation first

- Work in your own git worktree (`git worktree add <dir> -b <branch> origin/main`), never in a
  checkout someone else is using. Never `git stash` there: the stash list is shared by every
  worktree of the repo.
- A test panel gets its own empty data folder (`DATA_DIR=<empty folder>`), its own panel port
  (`PANEL_PORT`, not 25564) and its own game port range (`PORT_GAME_START`, `PORT_BEDROCK_START`,
  e.g. 35565 and 39132), so its servers never take a real server's port. Keep `PANEL_HOST` at
  127.0.0.1. No `.env` copied from a real install: `src/config` loads `.env` from the working
  folder.
- The panel's servers are sibling containers on whatever Docker daemon it reaches, named
  `msm-<serverId>` and labelled `msm.id=<serverId>`. Never point a test panel (`DOCKER_HOST`) at a
  daemon that runs real servers, never open a real server's world or backups, and never touch the
  maintainer's running panel. Use Docker on your own machine or a throwaway Linux VM. Write down the
  ids of the servers you create: cleanup goes by those ids, never by the label alone, since every
  panel on a daemon uses the same label.
- The stock `docker-compose.yml` names its container `minecraft-server-manager` and runs the
  published `:latest` image. Never `up` it as is for a test; see section 2.
- Outside contributors' code runs only in CI or a throwaway VM, never on a maintainer's computer
  and never next to a Docker socket that matters: the panel holds that socket, which is root on
  the host.

## 1. Cheap checks (before any push)

The CI gates, exactly as `.github/workflows/ci.yml` runs them (`checks`, `tests`, then
`docker-build` on PRs; the required `quality` check is green only when all three are):

```
pnpm install --frozen-lockfile   # never a plain install: it can rewrite package.json and the lockfile
pnpm run lint                    # ESLint, errors only
pnpm run format:check            # Prettier; pnpm run format fixes
pnpm run typecheck               # tsc --checkJs
pnpm test                        # node:test, no Docker; node --test test/<file>.test.js for one file
pnpm run build                   # Tailwind CSS + the esbuild bundle
```

Use the pnpm version that `packageManager` in package.json names (`npx pnpm@<version> <command>` if
yours can't switch). CI runs on Linux: on Windows a few tests can fail on `main` as well, so compare a
red local run with `origin/main` on the same machine before blaming your change.

A test that fails now and then is a bug: never rerun it until it passes, never add a sleep or skip
it. Find why, or delete it and say why in the PR.

## 2. Run it for real

A panel from source, for most changes (Docker must be running for anything that touches servers):

```
DATA_DIR=<empty folder> PANEL_PORT=35564 PORT_GAME_START=35565 PORT_BEDROCK_START=39132 pnpm run dev
```

`pnpm run dev` serves the raw `public/js`; `pnpm run build` then `pnpm start` with the same
variables serves the bundle the image ships. Open `http://127.0.0.1:35564`, finish first-run setup
with a test admin, and create servers with neutral names (`verify-paper`).

The PR's image, for changes to the Dockerfile, the compose file, `DATA_DIR_HOST` or anything that
only happens with the panel in a container: `docker build -t msm-verify:pr .`, then an override file
outside the repo (`ports: !override` needs Docker Compose 2.24.4 or later):

```yaml
services:
  panel:
    image: msm-verify:pr
    container_name: msm-verify-panel
    ports: !override
      - '127.0.0.1:35564:25564'
    environment:
      PORT_GAME_START: '35565'
      PORT_BEDROCK_START: '39132'
```

```
DATA_DIR_HOST=<absolute empty folder> docker compose -p msm-verify -f docker-compose.yml -f <override> up -d
```

That panel listens on every interface inside its container, so first-run setup asks for the PIN it
prints in `docker logs msm-verify-panel`.

Then pick what the diff touches:

| The change touches | Run |
|---|---|
| a route, a service, a permission | the feature in the browser and its API, as the admin and as a second user: an operator or viewer (Settings → Users) with a per-server grant (Settings → Permissions), in a private window. What the grant allows works; a hidden server answers not found |
| server lifecycle, `src/docker/`, ports, crash handling | a Vanilla or Paper server on a small version: create, start, stop, restart, kill from the panel; a crash behind the panel's back (`docker kill msm-<id>`, or the custom container name) shows in history as a crash (a SIGKILL never arms an auto-restart, so say how the restart path was reached); a status ping or a join on the game port |
| backups, restore, retention | a manual backup, a change to the world, a restore that brings it back; retention's preview and Remove Now on throwaway backups |
| modpacks, updates, mods | a server from a small Modrinth pack on an older version: the version is pinned, the update takes its pre-update backup and comes up, a rollback works; a custom zip (`.mrpack` or a few mod jars) for imports; a mod update and Revert |
| server.properties, World Controls, the field catalog | the change in the panel, then a restart of the server: the value survived in the file (Files tab) and in game |
| players, chat, RCON or log parsing | the real server's output on more than one type and version (Vanilla, Paper, a modded loader), and a Bedrock name with the Geyser/Floodgate prefix if names are involved |
| views, `public/js`, CSS | a real browser with its console open, on the dev run and on the bundle, dark and light (the top bar's theme button), phone width (390 px) and desktop |
| `/api/v1`, status pages, WebSockets | `/api/v1` with a Bearer token from Settings, a status page while signed out, a console tab in two windows at once |
| the Dockerfile, compose, `DATA_DIR_HOST` | the PR's image as above until `/healthz` answers and Docker reports it healthy, then a server created from it |
| `deploy/install.sh` | `node --test test/deploy-install.test.js`, `pnpm run test:deploy` (Docker mocked, in an Ubuntu container), and `pnpm run test:deploy:real` (a privileged container with its own Docker; it tests a published image tag, not your build) |

On the running panel, `QA_USER=<admin> QA_PASS=<password> DATA_DIR=<the panel's data folder>
pnpm run test:smoke http://127.0.0.1:35564` sweeps every page and server tab. It reads the panel's
database directly, so `DATA_DIR` must be the panel's own.

Write down what you ran and what you saw: commands, server types and versions, log lines, before
and after.

## 3. Screenshots

Every visible change: before (`main`) and after, dark and light, desktop and phone width. Neutral
server, world and player names; no real server names, addresses, domains, player names or tokens in
a shot. They go in the PR body, from a `pr-shots` branch (`<pr>/<name>.png`, never merged) embedded
from `raw.githubusercontent.com/anefzaoui/minecraft-server-manager/pr-shots/`. `docs/screenshots/`
and `docs/images/` change only when the docs do. A change with nothing to see shows its proof
(output, log lines) instead and says so.

## 4. Say what was and wasn't verified

The PR body ends its verification part with two lines:

```
Verified: <how: panel from source / PR image via compose, Docker Desktop or Linux, server types and versions, browser and widths, roles; or "CI gates only">
Not verified: <what wasn't: a loader, a platform, arm64, a real pack update, a reverse proxy> (or "nothing left")
```

## 5. Three strikes

If the same check fails three rounds in a row, stop: report what you tried, what you saw and what
you think is wrong, and ask. No fourth blind attempt.

## 6. Clean up

Delete the test servers in the panel, then make sure each is gone
(`docker ps -a --filter label=msm.id=<id>`) and remove leftovers by their own name only. Stop the
panel: Ctrl+C for a source run, `docker compose -p msm-verify -f docker-compose.yml -f <override>
down -v` for the image (the project name keeps it to the test panel). Never `docker system prune`
or any other prune: they hit every container on the daemon. Remove the images you made
(`docker image rm msm-verify:pr`) and the server images you pulled only if nothing else uses them.
Delete the test data folder, close the browsers and windows you opened, and delete `node_modules/`,
`public/css/app.css` and `public/dist/` from your worktree when done (keep the worktree).
