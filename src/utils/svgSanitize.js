'use strict';

const sanitizeHtml = require('sanitize-html');

// Uploaded avatars/server icons are served under a locked-down sandbox CSP +
// nosniff, which already stops an embedded <script> from running when the file
// is opened directly. This is the defence-in-depth layer behind that: scrub the
// SVG at rest so a hostile file never lands on disk in the first place (a proxy
// that strips the response headers, or a future direct <object>/<iframe> embed,
// would otherwise turn it into stored XSS). The official uploader rasterises SVG
// to PNG client-side, so in practice this only runs for direct API callers.
//
// Parsed in XML mode with case preserved: SVG is case-sensitive, so an
// allowlist that case-folds `linearGradient` / `clipPath` / `viewBox` would
// either drop those elements or emit attributes the renderer ignores.

// A conservative drawing-only subset.
const ALLOWED_TAGS = [
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'symbol',
  'use',
  'switch',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'clipPath',
  'mask',
  'marker',
  'filter',
  'feGaussianBlur',
  'feOffset',
  'feBlend',
  'feColorMatrix',
  'feMerge',
  'feMergeNode',
  'feComposite',
  'feFlood',
  'feMorphology',
  'feTile',
];

const ALLOWED_ATTRS = [
  'id',
  'class',
  'style',
  'transform',
  'xmlns',
  'xmlns:xlink',
  'version',
  'width',
  'height',
  'viewBox',
  'preserveAspectRatio',
  'd',
  'points',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'offset',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'patternUnits',
  'patternTransform',
  'patternContentUnits',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'orient',
  'refX',
  'refY',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-miterlimit',
  'opacity',
  'color',
  'stop-color',
  'stop-opacity',
  'clip-path',
  'clip-rule',
  'mask',
  'filter',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'letter-spacing',
  'word-spacing',
  'result',
  'in',
  'in2',
  'stdDeviation',
  'mode',
  'type',
  'values',
  'operator',
  'k1',
  'k2',
  'k3',
  'k4',
  'flood-color',
  'flood-opacity',
  'radius',
];

// Attributes (and the inline `style` attribute) may carry `url(...)` paint
// server references. Only same-document fragments (`url(#id)`) are inert;
// anything else is a fetch to a remote host - a tracking beacon at best.
const URL_REF_ATTRS = new Set(['fill', 'stroke', 'filter', 'mask', 'clip-path', 'marker']);
const EXTERNAL_URL_RE = /url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/i;
const ANY_URL_RE = /url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi;

function scrubStyle(value) {
  // Drop every declaration whose value references a non-fragment url(); keep
  // the rest of the inline style intact.
  return String(value)
    .split(';')
    .filter((decl) => {
      let external = false;
      for (const m of decl.matchAll(ANY_URL_RE)) {
        if (!String(m[2]).trim().startsWith('#')) external = true;
      }
      return !external;
    })
    .join(';');
}

function transformTag(tagName, attribs) {
  const out = {};
  for (const [name, value] of Object.entries(attribs)) {
    if (name === 'style') {
      const scrubbed = scrubStyle(value);
      if (scrubbed.trim()) out.style = scrubbed;
      continue;
    }
    if (URL_REF_ATTRS.has(name) && EXTERNAL_URL_RE.test(value)) continue;
    out[name] = value;
  }
  return { tagName, attribs: out };
}

/**
 * Strip scripting and external references from an SVG string, keeping only
 * inert drawing markup. `<script>`, `<foreignObject>`, event handlers, any
 * href/src (no javascript:, no data:, no remote <use>/<image>), and any
 * `url(...)` that is not a same-document `#fragment` are all dropped.
 */
function sanitizeSvg(input) {
  return sanitizeHtml(String(input || ''), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { '*': ALLOWED_ATTRS },
    // No href/xlink:href at all - removes javascript: URLs, data: URLs and
    // remote <use>/<image> references in one move.
    allowedSchemes: [],
    allowedSchemesAppliedToAttributes: [],
    allowProtocolRelative: false,
    parser: { xmlMode: true, lowerCaseTags: false, lowerCaseAttributeNames: false },
    disallowedTagsMode: 'discard',
    transformTags: Object.fromEntries(ALLOWED_TAGS.map((t) => [t, transformTag])),
  });
}

module.exports = { sanitizeSvg };
