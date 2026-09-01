// @ts-nocheck - dynamic HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// mclo.gs integration - the community log-paste service every mod author asks
// for. Two endpoints: POST /1/log publishes a log and returns a shareable
// paste URL; GET /1/insights/{id} runs mclo.gs's automated analysis over an
// existing paste (known problems with suggested solutions, detected server
// type/version). Sharing publishes the text on the PUBLIC internet, so every
// upload is an explicit user action - the panel never uploads on its own.

const httpError = require('../utils/httpError');

const BASE = 'https://api.mclo.gs/1';
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';
// mclo.gs caps pastes at 10 MB / 25k lines and keeps the TAIL when trimming.
// For a crash report the interesting part is the head, so trim client-side.
const MAX_BYTES = 9.5 * 1024 * 1024;

/** Publish text as a paste. Returns {id, url, rawUrl}. */
async function uploadLog(text) {
  const content = String(text || '').slice(0, MAX_BYTES);
  if (!content.trim()) throw httpError(400, 'Nothing to upload');
  const res = await fetch(`${BASE}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Accept: 'application/json' },
    body: new URLSearchParams({ content }).toString(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw httpError(502, 'mclo.gs is not responding right now. Please try again shortly.');
  const data = await res.json();
  if (!data.success || !data.id) {
    throw httpError(502, `mclo.gs rejected the upload${data.error ? `: ${data.error}` : ''}`);
  }
  return { id: data.id, url: data.url, rawUrl: data.raw };
}

/**
 * mclo.gs's automated analysis of an existing paste.
 * Returns {title, type, version, problems: [{message, counter, solutions: [string]}],
 *          information: [{label, value}]}.
 */
async function getInsights(pasteId) {
  const id = String(pasteId || '');
  if (!/^[A-Za-z0-9]{1,32}$/.test(id)) throw httpError(400, 'Invalid mclo.gs paste id');
  const res = await fetch(`${BASE}/insights/${id}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw httpError(502, 'mclo.gs is not responding right now. Please try again shortly.');
  const data = await res.json();
  if (data.success === false)
    throw httpError(502, `mclo.gs could not analyze that paste${data.error ? `: ${data.error}` : ''}`);
  const analysis = data.analysis || {};
  return {
    title: data.title || data.type || 'Log analysis',
    type: data.type || null,
    version: data.version || null,
    problems: (analysis.problems || []).map((p) => ({
      message: String(p.message || ''),
      counter: Number(p.counter) || 0,
      solutions: (p.solutions || []).map((s) => String(s.message || s)).filter(Boolean),
    })),
    information: (analysis.information || []).map((i) => ({
      label: String(i.label || ''),
      value: String(i.value || ''),
    })),
  };
}

module.exports = { uploadLog, getInsights };
