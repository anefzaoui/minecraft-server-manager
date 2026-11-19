'use strict';

// Minimal Prometheus text exposition (format 0.0.4) renderer. Just enough for
// the panel's gauges, so there is no client-library dependency.

/** Escape a label value: backslash, double quote, and newline. */
function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** HELP text escapes only backslash and newline. */
function escapeHelp(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

/**
 * @typedef {{ labels?: Record<string, string | number>, value: number | null | undefined }} Sample
 * @typedef {{ name: string, help: string, type?: 'gauge' | 'counter', samples: Sample[] }} Family
 */

/**
 * Render metric families. Samples whose value is null/undefined/non-finite are
 * dropped (an unknown reading is absent, not zero), and a family left with no
 * samples is omitted entirely.
 * @param {Family[]} families
 * @returns {string}
 */
function renderMetrics(families) {
  const lines = [];
  for (const fam of families) {
    const samples = fam.samples.filter((s) => s.value != null && Number.isFinite(s.value));
    if (!samples.length) continue;
    lines.push(`# HELP ${fam.name} ${escapeHelp(fam.help)}`);
    lines.push(`# TYPE ${fam.name} ${fam.type || 'gauge'}`);
    for (const s of samples) {
      const labels = Object.entries(s.labels || {})
        .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
        .join(',');
      lines.push(`${fam.name}${labels ? `{${labels}}` : ''} ${s.value}`);
    }
  }
  return lines.length ? lines.join('\n') + '\n' : '';
}

module.exports = { renderMetrics, escapeLabel };
