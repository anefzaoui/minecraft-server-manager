// Shared date/time formatting that honors the panel's configured timezone +
// locale (window.MSM, injected by the layout), falling back to the browser's
// own settings when absent. Use these instead of raw toLocaleString() so every
// timestamp renders in the operator's chosen zone.

function cfg() {
  const m = (typeof window !== 'undefined' && window.MSM) || {};
  return { timeZone: m.timezone || undefined, locale: m.locale || undefined };
}

// Accept Date | epoch ms (number or data-attribute string) | ISO string |
// SQLite 'YYYY-MM-DD HH:MM:SS' (UTC).
function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    if (/^\d{10,}$/.test(v)) return new Date(Number(v)); // epoch ms via dataset
    const s = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? v.replace(' ', 'T') + 'Z' : v;
    return new Date(s);
  }
  return new Date(NaN);
}

export function formatDateTime(v, extra = {}) {
  const d = toDate(v);
  if (isNaN(d.getTime())) return '';
  const { timeZone, locale } = cfg();
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone, ...extra }).format(d);
}

export function formatDate(v, extra = {}) {
  const d = toDate(v);
  if (isNaN(d.getTime())) return '';
  const { timeZone, locale } = cfg();
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone, ...extra }).format(d);
}

export function formatTime(v, extra = {}) {
  const d = toDate(v);
  if (isNaN(d.getTime())) return '';
  const { timeZone, locale } = cfg();
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone, ...extra }).format(d);
}

// Compact relative time ("just now", "5m ago", "3h ago", "2d ago", else a date).
export function timeAgo(v) {
  const d = toDate(v);
  if (isNaN(d.getTime())) return '';
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return formatDateTime(d); // future timestamp — not "just now"
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  if (secs < 7 * 86400) return `${Math.round(secs / 86400)}d ago`;
  return formatDate(d);
}

export function panelTimezone() {
  const m = (typeof window !== 'undefined' && window.MSM) || {};
  return m.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
