// The repository root (the folder that holds CHANGELOG.md and docs/). Found by
// walking up from the working folder rather than from import.meta.url: Astro
// bundles these modules into dist/ chunks at build time, so a path relative to
// the source file would point inside the build output.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function find() {
  let dir = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dir, 'CHANGELOG.md')) && existsSync(join(dir, 'docs'))) return dir;
    const up = dirname(dir);
    if (up === dir)
      throw new Error('Could not find the repository root (CHANGELOG.md + docs/) above the working folder.');
    dir = up;
  }
}

export const REPO_ROOT = find();
