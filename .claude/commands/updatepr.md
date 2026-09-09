---
description: Summarize every commit since the last upstream release and update the PR body
argument-hint: "[optional PR number]"
allowed-tools: Bash(git *), Bash(gh *)
---

## Goal

Refresh the description of the pull request for the current branch so it lists **every commit
added since the last upstream release**, each with a short plain explanation of what it does.

## Context to gather

- Upstream remote and repo: !`git remote -v | grep -E '^(upstream|origin)\s' | head -4`
- Current branch: !`git branch --show-current`
- Latest release on upstream: !`git remote get-url upstream >/dev/null 2>&1 && REPO=$(gh repo view upstream --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "") ; [ -z "$REPO" ] && REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner) ; gh release view -R "$REPO" --json tagName,publishedAt -q '.tagName + "  (" + .publishedAt + ")"'`
- Open PR for this branch: !`gh pr view ${ARGUMENTS:-} --json number,title,baseRefName,headRefName,url,body 2>&1 | head -60`

## Steps

1. **Find the range.** Fetch tags from upstream (`git fetch upstream --tags`). Take the latest
   release tag from the context above (call it `$LAST`). Verify the tag exists locally; if the
   repo tags it differently, fall back to `git describe --tags --abbrev=0 upstream/main`.
   The commit range is `$LAST..HEAD` (commits on the current branch not yet in that release).
2. **List the commits.** Run `git log --no-merges --reverse --format='%h %s' $LAST..HEAD`.
   For any commit whose subject is terse, run `git show --stat <hash>` to see what changed so the
   explanation is accurate. Do not invent commits that aren't in the range.
3. **Write the summary.** Produce a PR body with:
   - A 1–3 sentence overview of the branch's overall intent.
   - A `## Changes` section: one bullet per commit, oldest first, formatted
     `- **<subject>** (`<short hash>`) — <one plain sentence on what it does and why it matters>`.
     Group related commits under `###` subheadings only if the list is long (>15).
   - Keep any existing hand-written sections of the current PR body (testing notes, linked
     issues, screenshots) — replace only the overview + generated changes list.
   - Follow the repo copy style: sentence case, no infrastructure jargon, plain language.
4. **Apply it.** Write the body to a scratch file first, then update the PR in place.
   Prefer `gh pr edit <number> --body-file <tmpfile>`; if that fails with the classic-Projects
   GraphQL deprecation error, fall back to
   `gh api --method PATCH repos/<owner>/<repo>/pulls/<number> -F body=@<tmpfile>`.
   Use the PR number from `$ARGUMENTS` if given, otherwise the one resolved for the current
   branch. If no PR exists for the branch, print the generated body and stop — do not open a PR.
5. Preserve the trailing `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line
   if the existing body has one; otherwise leave attribution as-is.

Report the PR URL and a short diff of what changed in the description.
