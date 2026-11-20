// When a repository file last changed, from git, for "Last updated" on the docs,
// dateModified in their JSON-LD, and <lastmod> in the sitemap. One `git log`
// per file, cached for the build. CI checks out the full history
// (fetch-depth: 0 in .github/workflows/website.yml): a shallow clone would date
// every page to the last commit.
import { execFileSync } from 'node:child_process';
import { REPO_ROOT as repoRoot } from './repoRoot.js';
const cache = new Map();

/** @param {string} repoPath e.g. 'docs/backups.md' @returns {Date | undefined} */
export function lastCommitDate(repoPath) {
  if (cache.has(repoPath)) return cache.get(repoPath);
  let date;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', repoPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) date = new Date(out);
  } catch {
    // No git (a source tarball): pages simply carry no date.
  }
  cache.set(repoPath, date);
  return date;
}

/** The repository file a docs slug is generated from. */
export function docSource(slug) {
  return `docs/${slug === 'index' ? 'README' : slug}.md`;
}
