---
description: Update every dependency that can move safely, and flag the rest for review
argument-hint: "[optional package name to scope to]"
allowed-tools: Bash(pnpm *), Bash(git *), Bash(node *), Bash(npx *)
---

## Goal

Move every `package.json` dependency to its newest version that is **safe to take without a
migration**, apply the bumps, fix anything the bumps break, and hand the user a short list of the
updates that were held back because they need a human to check them.

Touch `package.json` and `pnpm-lock.yaml` only. Do not change application code except to repair a
break that a safe bump caused (see step 5).

## Context to gather

- Package manager and Node floor: !`node -p "const p=require('./package.json'); p.packageManager + '  node' + p.engines.node"`
- Working tree state: !`git status --porcelain=v1 package.json pnpm-lock.yaml`
- Current branch: !`git branch --show-current`
- Outdated report: !`pnpm outdated --format list 2>&1 | head -120`
- Outdated as JSON (authoritative): !`pnpm outdated --format json 2>/dev/null || echo '{}'`

## What counts as a safe bump

Take a bump automatically when **all** of these hold:

1. It is a version increase only (never a downgrade, never a re-pin to an older line).
2. The current major is `>= 1` and the new version keeps the **same major**
   (`^7.0.1 -> ^7.4.0` is safe; `^7.x -> ^8.0.0` is not).
3. For a `0.x` package, only the **patch** may move (`~1.0.7 -> ~1.0.9`, or `0.28.2 -> 0.28.4`).
   A `0.x` **minor** bump (`0.28.x -> 0.29.0`) is a review item; semver lets `0.x` minors break.
4. The package is not on the always-review list below.

**Always review, regardless of the number:** `eslint`, `@eslint/js`, `typescript`, `express`,
`tailwindcss`, `@tailwindcss/cli`, `dockerode`, `zod`, `pino`, `multer`, `ws`. These have either
config/flat-config surface, a compiler, or a wire/behaviour contract this app leans on; a minor bump
still deserves a changelog read.

Everything that is not a safe bump is a **review item**, not a silent skip.

## Steps

1. **Refuse a dirty lockfile area.** If `git status` above shows `package.json` or `pnpm-lock.yaml`
   already modified, stop and tell the user to commit or stash first. The rest of the branch being
   dirty is fine.
2. **Build the plan.** From the JSON outdated report, sort every entry into `safe` or `review`
   using the rules above. Keep both `dependencies` and `devDependencies`. If `$ARGUMENTS` names a
   package, restrict the whole run to that one package.
3. **Apply the safe set.** For each safe entry, edit the range in `package.json` in place, keeping
   the operator it already had (`^` stays `^`, `~` stays `~`, a bare pin stays a bare pin) and
   substituting the new version. Then run `pnpm install` once to refresh `pnpm-lock.yaml`. Do not
   run `pnpm update` blind; the edited ranges drive the install.
4. **Run every CI gate**, in this order, and read the output:
   - `pnpm run lint`
   - `pnpm run format:check`
   - `pnpm run typecheck`
   - `pnpm test`
   - `pnpm run build`
5. **Fix what the safe bumps broke.** A gate failure that traces to a safe bump is yours to repair
   now, in the smallest way that holds:
   - Prettier drift from a new `prettier` patch: `pnpm run format`.
   - New lint findings from an `eslint` plugin patch: fix the code, do not widen the config.
   - Type errors from a `@types/node` bump: correct the annotation or the call, keep `// @ts-nocheck`
     headers as they are.
   - A failing unit test: fix the code if the bump exposed a real bug; if the library deliberately
     changed behaviour, that bump is actually a review item. Revert it (restore its `package.json`
     range and re-run `pnpm install`) and move it to the review list with a note on what changed.
   - Never silence a gate (no eslint-disable, no skipped test, no `--no-verify`) to get a bump in.
6. **Re-run the gates** until all five pass with the safe set applied (minus anything you reverted
   in step 5).
7. **Do not commit.** Leave `package.json` and `pnpm-lock.yaml` modified in the working tree.

## Report back

- **Updated** — a table of `package | old range | new range | dep or dev`. One line per bump that
  survived the gates.
- **Needs review** — a table of `package | current | latest | why`. `why` is the concrete reason:
  major bump, `0.x` minor, on the always-review list, or "reverted: <behaviour change>" from step 5.
  Add the changelog or releases URL for each (`https://github.com/<repo>/releases` or the npm page).
- **Gates** — one line stating all five passed, or which failed and why if you had to stop.
- The diff of `package.json` (`git diff package.json`).

Keep the writeup in the repo copy style: plain sentences, sentence case, no infrastructure jargon in
anything a non-developer would read.
