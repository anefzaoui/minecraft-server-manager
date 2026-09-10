'use strict';

// Parse tick-performance output from the handful of commands that expose it.
// Vanilla has none of these, so callers must tolerate a null result.
//
//   Paper / Purpur / Pufferfish  `tps`   -> "TPS from last 1m, 5m, 15m: 19.98, 20.0, *20.0"
//   Paper                        `mspt`  -> "Server tick times ... from last 5s, 10s, 1m:" then "1.2/0.9/3.4, ..."
//   spark                        `spark tps` -> "TPS from last 5s, 10s, 1m, 5m, 15m: 20, 20, 20, 20, 20"
//   Forge / NeoForge             `forge tps` -> "Overall: Mean tick time: 3.456 ms. Mean TPS: 20.000"
//
// Returns { tps1, tps5, tps15, mspt, source } with nulls where a field is not
// reported, or null when the text matches nothing.

const NUM = /-?\d+(?:\.\d+)?/g;

function nums(str) {
  return (str.match(NUM) || []).map(Number).filter((n) => Number.isFinite(n));
}

/** Paper/Purpur `tps` and spark `tps` both start "TPS from last <windows>: <values>". */
function parseTpsLine(text) {
  const m = /TPS from last ([^:]+):\s*([^\n\r]+)/i.exec(text);
  if (!m) return null;
  const windows = (m[1].match(/\d+\s*[smh]/gi) || []).map((w) => w.replace(/\s+/g, '').toLowerCase());
  const values = nums(m[2]); // "*20.0" (capped) still yields 20.0
  if (!values.length) return null;
  const pick = (label) => {
    const i = windows.indexOf(label);
    return i !== -1 && values[i] != null ? values[i] : null;
  };
  // spark reports 5s/10s/1m/5m/15m; Paper reports 1m/5m/15m. Fall back to the
  // last three values when the window labels don't line up.
  return {
    tps1: pick('1m') ?? values[values.length - 3] ?? values[0] ?? null,
    tps5: pick('5m') ?? values[values.length - 2] ?? null,
    tps15: pick('15m') ?? values[values.length - 1] ?? null,
  };
}

/** Forge / NeoForge `tps` - one "Overall:" summary line. */
function parseForgeTps(text) {
  const m = /Overall\s*:?.*?Mean tick time:\s*(-?\d+(?:\.\d+)?)\s*ms.*?Mean TPS:\s*(-?\d+(?:\.\d+)?)/is.exec(text);
  if (!m) return null;
  return { tps1: Number(m[2]), tps5: null, tps15: null, mspt: Number(m[1]) };
}

/** Paper `mspt` - "... from last 5s, 10s, 1m:" then a "avg/min/max, ..." line. */
function parseMspt(text) {
  if (!/tick times|mspt/i.test(text)) return null;
  const m = /(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/.exec(text);
  return m ? Number(m[1]) : null;
}

function parseTps(raw) {
  const text = String(raw || '');
  if (!text.trim()) return null;

  const forge = parseForgeTps(text);
  if (forge) return { tps5: null, tps15: null, mspt: null, source: 'forge', ...forge };

  const line = parseTpsLine(text);
  if (line) {
    const source = /from last \d+\s*s/i.test(text) ? 'spark' : 'paper';
    return { mspt: parseMspt(text), source, ...line };
  }

  const mspt = parseMspt(text);
  if (mspt != null) return { tps1: null, tps5: null, tps15: null, mspt, source: 'paper' };

  return null;
}

module.exports = { parseTps };
