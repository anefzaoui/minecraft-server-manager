// Shared number/size formatting. One byte formatter for the whole panel —
// three pages had drifted copies, all with a floor that rendered 0 bytes as
// "1 KB" ("Total: 1 KB in 0 archives"). Mirrors the server-side `bytes`
// Handlebars helper (src/web/app.js) so a size never renders differently in a
// toast than in its table cell.

export function fmtBytes(bytes) {
  const n = Number(bytes);
  if (n === 0) return '0 B';
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log2(Math.abs(n)) / 10), units.length - 1);
  const value = n / 2 ** (10 * i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
