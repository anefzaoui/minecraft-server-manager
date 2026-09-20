'use strict';

// Builds docs/images/contributors.svg - the avatar strip in the README.
//
// One self-contained SVG with the avatars embedded, so the README never points
// at a third-party image service: nothing else can break, rate-limit, or serve
// a stale strip, and the repo keeps working offline and in a fork.
//
// Refresh it with `pnpm run contributors`, or let
// .github/workflows/contributors.yml do it on a monthly schedule (it opens a
// PR, because `main` is protected).
//
// The layout and rendering below are pure functions so the unit test can check
// them without touching the network; only `main()` talks to GitHub.

const fs = require('node:fs/promises');
const path = require('node:path');

const REPO = process.env.CONTRIBUTORS_REPO || 'anefzaoui/minecraft-server-manager';
const OUT_FILE = path.join(__dirname, '..', 'docs', 'images', 'contributors.svg');

const AVATAR = 64; // rendered size, in CSS pixels
const SCALE = 2; // fetched at 2x so the strip stays sharp on a retina screen
const GAP_X = 10;
const GAP_Y = 14;
const LABEL_H = 16;
const LABEL_FONT = 10.5;
// Average glyph width of the font stack below at LABEL_FONT. Only used to size
// cells and decide when a login needs shortening, so an approximation is fine.
const CHAR_W = 6.15;
const CELL_MAX = 104; // a very long login shortens rather than stretching the row
const PAD = 8;
const PER_ROW = 8;
const MAX_FACES = 24; // past this, the last tile becomes "+N"
const FONT = '-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,Helvetica,Arial,sans-serif';
// One mid grey for the labels and rings. An SVG used as an <img> cannot ask the
// page whether it is on GitHub's light or dark canvas, so this has to read on
// both rather than switch.
const INK = '#8b949e';

/** XML-escape a text node or attribute value. */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Pick and order the faces to draw.
 * @param {Array<{ login?: string, type?: string, contributions?: number, avatar_url?: string }>} rows
 *   raw GitHub `/contributors` rows
 * @param {{ max?: number }} [opts]
 * @returns {{ people: Array<{ login: string, avatarUrl: string, contributions: number }>, overflow: number }}
 */
function pickContributors(rows, { max = MAX_FACES } = {}) {
  const people = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.login && r.type !== 'Bot' && !/\[bot\]$/i.test(r.login))
    .map((r) => ({
      login: String(r.login),
      avatarUrl: String(r.avatar_url || ''),
      contributions: Number(r.contributions) || 0,
    }))
    // The API already sorts by commit count; the login tiebreak keeps the file
    // byte-identical between runs when two people are level.
    .sort((a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login));
  return { people: people.slice(0, max), overflow: Math.max(0, people.length - max) };
}

/** Label as drawn: shortened with an ellipsis when it cannot fit a cell. */
function labelFor(login, maxChars) {
  return login.length > maxChars ? `${login.slice(0, Math.max(1, maxChars - 1))}…` : login;
}

/**
 * Geometry for the whole strip.
 * @param {Array<{ login: string }>} people
 * @param {{ overflow?: number }} [opts]
 */
function layout(people, { overflow = 0 } = {}) {
  const tiles = [
    ...people.map((p) => ({ ...p })),
    ...(overflow > 0 ? [{ login: `+${overflow}`, overflow: true }] : []),
  ];
  const maxChars = Math.max(4, Math.floor((CELL_MAX - 4) / CHAR_W));
  const widest = tiles.reduce((n, t) => Math.max(n, labelFor(t.login, maxChars).length * CHAR_W), 0);
  const cellW = Math.max(AVATAR, Math.min(CELL_MAX, Math.ceil(widest) + 8));
  const cols = Math.min(tiles.length, PER_ROW) || 1;
  const rows = Math.max(1, Math.ceil(tiles.length / PER_ROW));
  const cells = tiles.map((tile, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const cellX = PAD + col * (cellW + GAP_X);
    return {
      ...tile,
      label: labelFor(tile.login, maxChars),
      cx: cellX + cellW / 2,
      cy: PAD + row * (AVATAR + LABEL_H + GAP_Y) + AVATAR / 2,
      x: cellX + (cellW - AVATAR) / 2,
      y: PAD + row * (AVATAR + LABEL_H + GAP_Y),
    };
  });
  return {
    cells,
    width: cols * (cellW + GAP_X) - GAP_X + PAD * 2,
    height: rows * (AVATAR + LABEL_H + GAP_Y) - GAP_Y + PAD * 2,
  };
}

/**
 * The finished SVG.
 * @param {Array<{ login: string, dataUri?: string }>} people avatars already fetched
 * @param {{ overflow?: number }} [opts]
 */
function renderSvg(people, { overflow = 0 } = {}) {
  const { cells, width, height } = layout(people, { overflow });
  const names = people.map((p) => p.login).join(', ');
  const alt = overflow > 0 ? `${names}, and ${overflow} more` : names;
  const parts = [];
  const defs = [];
  cells.forEach((cell, i) => {
    const r = AVATAR / 2;
    if (cell.overflow) {
      parts.push(
        `<circle cx="${cell.cx}" cy="${cell.cy}" r="${r - 0.5}" fill="none" stroke="${INK}" stroke-opacity=".35"/>`,
        `<text x="${cell.cx}" y="${cell.cy + 5}" text-anchor="middle" font-family="${FONT}" font-size="15" fill="${INK}">${escapeXml(cell.login)}</text>`
      );
    } else {
      defs.push(`<clipPath id="a${i}"><circle cx="${cell.cx}" cy="${cell.cy}" r="${r}"/></clipPath>`);
      parts.push(
        `<image href="${cell.dataUri}" x="${cell.x}" y="${cell.y}" width="${AVATAR}" height="${AVATAR}" clip-path="url(#a${i})" preserveAspectRatio="xMidYMid slice"/>`,
        `<circle cx="${cell.cx}" cy="${cell.cy}" r="${r - 0.5}" fill="none" stroke="${INK}" stroke-opacity=".35"/>`
      );
    }
    parts.push(
      `<text x="${cell.cx}" y="${cell.y + AVATAR + 12}" text-anchor="middle" font-family="${FONT}" font-size="${LABEL_FONT}" fill="${INK}">${escapeXml(cell.label)}</text>`
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `role="img" aria-label="Contributors: ${escapeXml(alt)}">` +
    `<title>Contributors: ${escapeXml(alt)}</title>` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    parts.join('') +
    '</svg>\n'
  );
}

// ---------------------------------------------------------------------------
// Network side: only main() below this line.

function ghHeaders() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'minecraft-server-manager-contributors-script',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchContributors() {
  const url = `https://api.github.com/repos/${REPO}/contributors?per_page=100&anon=0`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${url}`);
  return res.json();
}

/** Avatar as a data URI, asked for at the exact size the strip draws it. */
async function fetchAvatar(avatarUrl) {
  const url = new URL(avatarUrl);
  url.searchParams.set('s', String(AVATAR * SCALE));
  const res = await fetch(url, { headers: { 'User-Agent': ghHeaders()['User-Agent'] } });
  if (!res.ok) throw new Error(`Avatar fetch failed (${res.status}) for ${url}`);
  const type = res.headers.get('content-type') || 'image/png';
  const body = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${body.toString('base64')}`;
}

async function main() {
  const { people, overflow } = pickContributors(await fetchContributors());
  if (!people.length) throw new Error('GitHub returned no contributors; refusing to write an empty strip.');
  const withAvatars = [];
  for (const person of people) {
    withAvatars.push({ ...person, dataUri: await fetchAvatar(person.avatarUrl) });
  }
  const svg = renderSvg(withAvatars, { overflow });
  const previous = await fs.readFile(OUT_FILE, 'utf8').catch(() => null);
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, svg);
  const rel = path.relative(path.join(__dirname, '..'), OUT_FILE);
  const size = `${Math.round(svg.length / 1024)} KB`;
  console.log(
    previous === svg
      ? `[contributors] ${rel} is already up to date (${people.length} faces, ${size}).`
      : `[contributors] wrote ${rel} - ${people.length} faces${overflow ? ` + ${overflow} more` : ''}, ${size}.`
  );
}

module.exports = { pickContributors, labelFor, layout, renderSvg, escapeXml, AVATAR, PER_ROW, MAX_FACES };

if (require.main === module) {
  main().catch((err) => {
    console.error(`[contributors] ${err.message}`);
    process.exit(1);
  });
}
