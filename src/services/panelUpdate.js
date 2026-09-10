'use strict';

// Panel self-update check ("Update MSM" on the Settings page): compares the
// installed app version against the newest GitHub release and surfaces a link
// to it. Never modifies panel files - the admin downloads and installs the
// release themselves. On-demand only: rendering the Settings page never calls
// GitHub; the button (or the API) triggers the lookup, backed by the same
// ETag-cached github: api_cache row every other GitHub lookup uses.

const httpError = require('../utils/httpError');
const db = require('../db');
const githubApi = require('./githubApi');
const installedVersion = require('../../package.json').version;

const PANEL_REPO = 'anefzaoui/minecraft-server-manager';
// Mapped result row (the underlying github: row already carries ETag + TTL).
const CACHE_KEY = 'panel-latest-release';
const RELEASES_CACHE_KEY = `github:/repos/${PANEL_REPO}/releases?per_page=10`;

/** "v1.2.3" or "1.2.3" -> [1,2,3]; anything else (pre-release tags, junk) -> null. */
function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** -1 / 0 / 1 when both are semver, else null (don't guess on unknown shapes). */
function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  if (!av || !bv) return null;
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return av[i] < bv[i] ? -1 : 1;
  }
  return 0;
}

function readCached() {
  const row = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', CACHE_KEY);
  if (!row) return null;
  return { ...JSON.parse(row.value_json), checkedAt: row.fetched_at };
}

/**
 * Check for a newer panel release.
 * @param {object} [opts]
 * @param {boolean} [opts.refresh] drop caches and hit GitHub for real.
 * @returns {Promise<object>} { current, latest|null, isNewer, error|null, checkedAt|null }
 *  - GitHub down with a stale-cache to fall back on: degrades with error set.
 *  - GitHub down with nothing cached: throws (route turns it into a 502).
 */
async function checkLatest({ refresh = false } = {}) {
  if (refresh) {
    db.run('DELETE FROM api_cache WHERE key IN (?, ?)', CACHE_KEY, RELEASES_CACHE_KEY);
  }
  try {
    // Newest STABLE release: a pre-release tag (v0.13.0-rc.1) must never be
    // offered as "the update" to a panel running the stable line.
    const releases = await githubApi.getReleases(PANEL_REPO, { limit: 10 });
    const release = (releases || []).find((r) => !r.prerelease);
    const latest = release
      ? {
          version: String(release.tag).replace(/^v/, ''),
          tag: release.tag,
          name: release.name || null,
          publishedAt: release.publishedAt || null,
          htmlUrl: release.htmlUrl || null,
        }
      : null;
    const result = {
      current: installedVersion,
      latest,
      isNewer: latest ? compareVersions(latest.version, installedVersion) === 1 : false,
      error: null,
    };
    db.run(
      `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
      CACHE_KEY,
      JSON.stringify({ current: result.current, latest, isNewer: result.isNewer, error: null })
    );
    return result;
  } catch (err) {
    const cached = readCached();
    if (cached) {
      return { ...cached, error: err.message || 'Could not check GitHub right now.' };
    }
    if (err && err.status) throw err;
    throw httpError(502, `Could not reach GitHub: ${err.message || 'unknown error'}`);
  }
}

module.exports = { checkLatest, compareVersions, parseVersion, PANEL_REPO, installedVersion };
