---
description: Use CodeGraph to check the README and docs against the real code, then fix what's drifted
argument-hint: "[optional path or doc name to scope to]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git *), Bash(node *), Bash(npx *), Bash(ls *), Bash(find *), Bash(codegraph *), mcp__codegraph__codegraph_explore
---

## Goal

Walk the whole project through CodeGraph, compare what the code actually does against what the
Markdown docs claim, and correct every place they've drifted apart. Keep the docs' structure, voice,
and hand-written prose. Fix facts, not style.

**In scope:** `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and everything under `docs/**.md`.

**Never touch:** `CLAUDE.md`, anything under `.claude/`, and any other Claude- or agent-specific
file. Do not add references to Claude, Claude Code, or AI assistants to any doc. If a doc already
mentions them, leave that text exactly as it is.

## Context to gather

- Target files: !`find . -name '*.md' -not -path './node_modules/*' -not -path './.git/*' -not -path './data/*' -not -path './.claude/*' -not -name 'CLAUDE.md' | sort`
- Version and Node floor: !`node -p "const p=require('./package.json'); p.name + ' ' + p.version + '  node' + (p.engines&&p.engines.node) + '  ' + p.packageManager"`
- Top-level layout: !`ls -1`
- Route domains: !`ls -1 src/web/routes 2>/dev/null`
- Service domains: !`ls -1 src/services 2>/dev/null`
- Infra modules: !`ls -1 src/docker src/db src/storage src/config 2>/dev/null`
- DB migrations on disk: !`ls -1 src/db/migrations 2>/dev/null`
- npm scripts: !`node -p "Object.keys(require('./package.json').scripts).join(', ')"`
- Recent history for signal on what moved: !`git log --oneline -40`
- Working tree state: !`git status --porcelain=v1`

## Steps

1. **Refuse a dirty doc tree.** If `git status` above shows any in-scope Markdown file already
   modified, stop and tell the user to commit or stash those first. Other unrelated changes in the
   tree are fine.

2. **Survey the project through CodeGraph.** Lead with `codegraph_explore` (or the
   `codegraph explore "…"` shell form) before reading source by hand. Make a handful of broad passes,
   one query each:
   - the boot sequence and overall architecture / layering
   - every Express router and what each one mounts, public zone vs. authed zone
   - the service layer: which domains exist and what each owns
   - the infrastructure wrappers (`docker/`, `db/`, `storage/`) and their public APIs
   - the config surface: env vars, the field catalog, secret handling, port allocation, disk quotas
   - the WebSocket + events cross-cutting pieces
   - the public API (`/api/v1`) surface and auth model
   Then run one targeted query per doc topic you're about to verify (backups, world shrink,
   blueprints, schedules, modpacks, 2FA, integrations, updates, users and roles, …).

3. **Diff each doc against reality.** Read every in-scope file. For each, check the concrete claims:
   - file and directory paths, module names, function and route names
   - env var names and their defaults, `server.properties` / itzg keys
   - feature descriptions: does the behaviour the doc describes match the code path?
   - counts and lists ("seven routers", "these five gates", a list of supported loaders)
   - version numbers, the Node floor, the package manager, command names and `pnpm` scripts
   - cross-references and relative links between docs, and links into the source tree
   - anything describing a feature that no longer exists, or omitting one that now does

4. **Fix the drift, minimally.** Edit in place. Correct wrong facts, update stale paths and names,
   refresh counts and lists, add a short entry for a feature that's clearly shipped but undocumented,
   and remove a description of something that's gone. Do not restructure a doc, rewrite prose that's
   still accurate, change its heading outline, or "improve" wording that isn't wrong. When a whole
   section is beyond a light touch, note it in the report rather than rewriting it wholesale.

5. **CHANGELOG.md:** only reconcile existing entries with what actually landed (fix a wrong path,
   a renamed feature, a mis-stated version). Do not invent new release entries or move the
   unreleased boundary.

6. **Hold the copy style.** Sentence case in prose, Title Case in headings per the repo house style,
   straight quotes, no infrastructure jargon in user-facing wording, proper nouns capitalised
   (Minecraft, Docker, Java, RCON, Modrinth, CurseForge, BlueMap, Node.js, pnpm, …). Match the
   surrounding doc.

7. **Run the doc gate.** `npx prettier --check` on every file you changed; run `npx prettier --write`
   on any that fail and re-check. If the repo has a Markdown link checker wired into `package.json`,
   run it too.

8. **Do not commit.** Leave the edited Markdown in the working tree for the user to review.

## Report back

- **Files changed** — one `###` block per file. Under each, a bullet list of every correction as
  `was → now — why` (cite the code that settles it, e.g. `src/web/routes/worlds.js`).
- **Verified clean** — a one-line list of in-scope files you checked and found already accurate.
- **Needs a human** — anything you spotted as stale or thin but didn't rewrite because it's a
  judgement call or a larger rework, with a sentence on what's off.
- **Gate** — one line: Prettier (and the link checker, if run) passed, or what failed.
- The combined diff: `git diff -- '*.md'`.

Keep the writeup in the repo copy style: plain sentences, sentence case, no jargon a non-developer
would trip on.
