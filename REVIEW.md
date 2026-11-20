# Review checklist

What to check in a pull request, by what its diff touches. Check only the items a diff triggers;
most PRs trigger a few. The reviewer reads this file from `main`, never from the PR under review. A
PR that changes this file, CI workflows, tests or the verify skill (`.claude/skills/verify`) is
reviewed against `main`'s copy, and more strictly.

An item is added when the same kind of miss has shown up in two pull requests and can be seen from
a diff. Items that stop earning their place are removed.

## Every PR

- [ ] It was run the way a server owner runs it, as the verify skill says, and the PR says how
      (`Verified:`) and what wasn't (`Not verified:`).
- [ ] The `quality` check is green on the head commit, and no red test was rerun until it passed.
- [ ] README.md and the pages in `docs/` that describe the changed behaviour say the new truth.
- [ ] Every visible change has screenshots (dark, light, desktop, phone width).
- [ ] The review and the merge are for the same commit (merge with that commit's SHA).

## Permissions and routes

- **Triggered by:** a new or changed route in `src/web/routes/`, a page, a WebSocket, or anything
  that lists, counts or exports across servers.
  - [ ] A route under `/servers/:id` sits behind `serverScope` and names its capability with
        `requireCap`; a write that names its server in the body checks the capability itself.
        `test/permissions-routes.test.js` passes without being loosened, and the capability's
        `reach` list in `src/services/permissions.js` names the new route.
  - [ ] Lists, counts, badges, tasks, history and exports leave out servers the user can't view,
        and a GET that changes something needs the capability of the change.
  - [ ] Checked live as a second user (an operator or viewer with a per-server grant): what the
        grant allows works, a hidden server answers not found.
- **Triggered by:** a route mounted before `requireAuth` (`routes/status.js`, `routes/apiV1.js`)
  or the WebSocket upgrade.
  - [ ] It stays read-only and off until enabled (a status page per server, `/api/v1` in
        Settings), shows only what that page or token was made to show, and `/api/v1` keeps its
        own rate limits; a socket checks the session and the `Origin`.

## Files and paths

- **Triggered by:** a path built from anything a person, an upload, an archive, a mod registry or
  a server sent (server, world, backup, file, mod or player names), or any file call under the data
  folder.
  - [ ] It goes through `safeJoin` / `dataPath` (`src/storage/pathGuard.js`), never a hand-joined
        path, and a symlink inside the data folder can't lead out of it.
  - [ ] Archives go through the shared zip helpers (`src/utils/zip.js`) and uploads stay
        size-capped.
  - [ ] It's built with `node:path`, so a dev run on Windows gets the same folders as Linux.
- **Triggered by:** deleting, pruning, overwriting or renaming files, backups or library entries.
  - [ ] It removes only what it showed or was asked for, holds the server's lock while it does, and
        can't remove a backup a restore is using. Tried for real on a throwaway server.

## Docker and containers

- **Triggered by:** a change under `src/docker/` or `src/services/dockerSpec.js`, or code that
  creates, rebuilds, starts, stops or removes a server's container, or sets its binds, network,
  name or ports.
  - [ ] It goes through dockerode, never the `docker` CLI, and touches only containers labelled
        with this server's `msm.id`.
  - [ ] Paths handed to Docker go through `src/docker/hostPath.js`, so it also works with the panel
        in a container (`DATA_DIR_HOST`).
  - [ ] Extra binds, networks, ports and container names stay admin-only, and a custom name can't
        use the `msm-` prefix.
  - [ ] A change in several steps (stop, remove, rebuild, start) leaves the server on its old
        settings, or honestly marked as waiting for a rebuild, when any step fails; the PR says
        which steps were made to fail, and it was tried on a real daemon.

## Server output and player names

- **Triggered by:** parsing RCON replies, server logs, crash reports or Docker events, or a player
  name used in a check, a command or a path.
  - [ ] Checked against real output from more than one server type and Minecraft version (Vanilla,
        Paper, a modded loader); output it doesn't recognise reads as unknown, never as success.
  - [ ] Player names go through `src/utils/playerName.js` (it accepts the Geyser/Floodgate prefix),
        not a local pattern; nothing a person typed reaches a console command or `docker exec`
        unvalidated.

## Server settings and server.properties

- **Triggered by:** a write to `server.properties`, World Controls, the whitelist, or the field
  catalog (`src/config/field-catalog/`).
  - [ ] Property writes go through `writeServerProperties()` / `setServerProperty()` in
        `src/services/servers.js`; a property-backed field carries its `prop:` and the
        field-catalog tests pass against the vendored fixture.
  - [ ] The value survives a real restart of the server (the image re-applies its environment on
        every start).

## Modpacks and updates

- **Triggered by:** installing a pack (any wizard tab), the update and rollback flow
  (`src/updates/`, `src/services/packPins.js`), or an environment write that carries a pack
  selector.
  - [ ] Every path ends on a concrete, pinned version, never "latest", and the choices made in the
        wizard (pinned selectors, loader, version) reach the server it creates.
  - [ ] An update takes its pre-update backup before it stops anything, and a failed one can be
        rolled back. Tried with a real small pack: an update and a rollback.

## Database migrations

- **Triggered by:** a new or changed file in `src/db/migrations/`.
  - [ ] It takes the next unused number. A released migration is never edited, renumbered or
        deleted; only one that never shipped may be dropped, with a later one cleaning up after it.
  - [ ] It boots on a copy of a data folder from the latest release and keeps its rows; anything
        that deletes or rewrites rows was checked against real data and has a test.

## Pages, browser JS and styles

- **Triggered by:** `views/`, `public/js/`, `assets/css/input.css`, or the Handlebars helpers in
  `src/web/app.js`.
  - [ ] JSON for the browser goes through `jsonScript` / `jsonAttr`, and a helper takes every value
        it is given.
  - [ ] Opened in a real browser with the console open, on a dev run (raw `public/js`) and on the
        built bundle, in dark and light, at phone and desktop width, with no sideways scrolling.
  - [ ] Semantic tokens and the shared components only, Tailwind classes as full literals,
        mobile-first breakpoints.

## User-facing copy

- **Triggered by:** any text a person reads in the panel or the docs.
  - [ ] It follows the house style in CONTRIBUTING.md: casing, final punctuation, `…` on
        in-progress lines, no sentence dashes, no infrastructure jargon, friendly errors.
  - [ ] It's true: every control, tab or setting it names exists under that name for the roles
        that see the text.

## Tests

- **Triggered by:** a new or changed test.
  - [ ] It requires `test/helpers/env` (or `test/helpers/app`) before any `src/` module, and reaches
        no Docker daemon, network or real data folder (it passes on a machine without Docker).
  - [ ] It doesn't pass by luck: no wall-clock budgets of a few dozen milliseconds, no fixed sleeps,
        and it was run several times. A flaky test is fixed or removed with the reason, never rerun.
  - [ ] A test for a fix fails when the fix is taken out.

## Build, CI and dependencies

- **Triggered by:** `package.json`, `pnpm-lock.yaml`, the Dockerfile, `docker-compose.yml`,
  `deploy/`, `.github/`, or `public/vendor/`.
  - [ ] Only intended changes: no ranges widened or lockfile rewritten by a local install, and
        `pnpm install --frozen-lockfile` passes. A vendored Chart.js update names its version.
  - [ ] The image builds and reaches healthy with a real data folder mounted; an installer change
        comes with a scenario in `test/deploy/install-scenarios.sh`.
  - [ ] Jobs that run a PR's code keep the read-only token and get no secrets.

## Outside contributions

- **Triggered by:** a PR from outside the maintainers that touches `.github/`, the Dockerfile,
  `deploy/`, `scripts/` (`postinstall.js` runs on every install), `package.json` or the lockfile, a
  test's expectations, this file or the verify skill.
  - [ ] Read every line; nothing reaches the network, secrets, the Docker socket or the release,
        and no check got looser. Its code runs only in CI or a throwaway VM.
