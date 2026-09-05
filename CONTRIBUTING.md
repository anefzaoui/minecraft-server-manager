# Contributing

Thanks for your interest in improving Minecraft Server Manager. This project is a server-rendered
Node.js app with a minimal build step (Tailwind CSS plus an esbuild client-JS bundle), so the
barrier to hacking on it is low.

## Getting set up

```bash
pnpm install
pnpm run dev        # starts the app with auto-restart + Tailwind CSS watch
```

`pnpm run dev` serves the browser JS straight from `public/js/`. `pnpm run build:js` produces the
minified esbuild bundle in `public/dist/` (a gitignored artifact); the app serves it when present
and falls back to raw source otherwise, so you only need it to test the production bundle.

Open http://localhost:25564. You need **Node.js 24+** (for the flagless built-in `node:sqlite`) and
Docker running to exercise anything that touches containers. First run creates the admin account.

All state lives under `./data` (or `$DATA_DIR`). To start from a clean slate, stop the app and delete
that directory - it's rebuilt on boot.

## Before you open a PR

These are the exact gates CI runs - each works on a clean clone with no Docker or running app:

```bash
pnpm run lint          # ESLint (errors, no warnings)
pnpm run format:check  # Prettier
pnpm run typecheck     # tsc --checkJs over the type-clean core
pnpm test              # unit tests (node:test)
pnpm run build         # Tailwind CSS + esbuild client-JS bundle
```

`pnpm run format` fixes formatting. `pnpm test` is a real, fast unit suite (no Docker); `pnpm run
test:smoke` is the separate live sweep against a running panel. While iterating on a change, `pnpm run
test:watch` re-runs the suite on every save.

`main` is protected: the CI job `quality` (all five gates above) is a required status check, the PR
branch must be up to date with `main`, and direct pushes, force pushes and deletion are blocked for
everyone including admins. Every change - releases too - lands through a PR, which is what keeps the
`:latest` image and GitHub Release workflows (both fire on push to `main`) from ever publishing an
untested commit.

Keep changes focused and match the surrounding style (Prettier enforces it). Server code is **plain
CommonJS JS - no TypeScript compile step**. The browser code in `public/js/` is ESM, bundled and
minified by **esbuild** into `public/dist/js/` for production; it is not a framework and not a build
prerequisite for development, so keep it hand-written progressive enhancement. Type safety comes
from JSDoc + a `tsc --checkJs` gate: `types/globals.d.ts` holds ambient augmentations, and dynamic
interop files (Docker/NBT/HTTP-JSON) carry a `// @ts-nocheck` header while type coverage is grown
incrementally - new modules are checked by default, so keep them clean.

`public/vendor/chart.umd.js` is a **vendored** copy of Chart.js (not a package dependency) - update it by
hand and note the version in the PR.

## How the code is organized

The full picture is in [`docs/architecture.md`](docs/architecture.md). The short version:

**Layering - one direction only:**

```
web/routes (HTTP)  →  services (domain logic)  →  docker / db / storage (infrastructure)
```

- **`web/routes/`** - Express routers. Parse/validate input (zod), call a service, shape the
  response. No business logic here.
- **`services/`** - the domain logic. This is where features live. Services may call `docker/`,
  `db/`, `storage/`, and each other.
- **`docker/`, `db/`, `storage/`** - infrastructure. `docker/` wraps dockerode; `db/` wraps
  `node:sqlite` + migrations; `storage/` owns the `./data` layout, the path guard, and disk quotas.
- **`config/field-catalog/`** is the **single source of truth** for server settings - every itzg
  environment variable, its friendly label, help text, type, default, and validation. Add a server
  setting here and the wizard/forms/validation pick it up automatically.
- **`events/`** and **`ws/`** are cross-cutting: `recordEvent()` is the one entry point for history,
  and `ws/` carries the live console + stats sockets.

## Two conventions that will surprise you

1. **Never touch the filesystem under `./data` directly.** Always resolve paths through the path
   guard in `src/storage/` (`safeJoin`). It rejects any path that escapes the data root, which is the
   backbone of the app's file-safety story. Uploads and archive extraction are additionally
   size-capped.
2. **Lazy `require()` calls are intentional cycle-breakers.** Some modules `require()` a sibling
   _inside a function_ rather than at the top of the file to avoid a circular dependency at load
   time. If you see `const x = require('...')` mid-function, that's why - don't "clean it up" by
   hoisting it without checking for the cycle.

## Shared helpers

Prefer the shared helpers over re-implementing patterns:

- `src/utils/httpError.js` - `httpError(status, message)` for throwing HTTP errors from services.
- `src/web/middleware/jsonErrorHandler.js` - the standard JSON error handler (redacts 5xx detail).
- `src/web/middleware/asyncHandler.js` - wraps async route handlers so rejections reach the error
  handler. Prefer it over hand-written `try/catch → next(err)`.

## Logging

Server code logs through `src/logger.js`, never `console.*` (ESLint enforces this under `src/`; only
`preflight.js`, `instrument.js`, and `config/index.js` run before the logger exists and are exempt).
At the top of a module:

```js
const logger = require('../logger')(require('node:path').basename(__filename));
```

- **Message string:** one plain sentence, sentence case, ending in `.`, `!`, or `?`, with **no
  colon**. Every variable goes in the structured second argument, not interpolated into the text -
  `logger.info('Started a server.', { serverId, actor })`, not ``logger.info(`Started server ${id}`)``.
- **Levels:** `info` = start/finish of a state-changing operation; `debug` = rejected input, early
  returns, intermediate steps, high-frequency read paths; `warn` = recoverable failure; `error` =
  a failure carrying a stack (pair it with `captureError(err, …)` from `src/instrument.js`); `fatal`
  = the process is going down.
- **One owner per error.** A `catch` that rethrows or calls `next(err)` does not log - the error
  handler owns it. A `catch` that swallows and handles locally logs exactly once.
- **Secrets:** `src/utils/logSanitize.js` redacts secret-shaped keys and strips URL query strings,
  but don't hand the logger request bodies, passwords, tokens, or full entity lists - pass ids and
  counts. In hot loop bodies pass primitives only.
- High-frequency background loops use `makeFailureThrottle()` from `src/logger.js` so a persistent
  failure logs once, not every tick.

## Reporting bugs / requesting features

Open an issue with clear reproduction steps (and your OS + Docker flavor for anything
environment-specific). Security issues: please report privately rather than in a public issue.
