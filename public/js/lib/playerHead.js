// Player head rendering: fetch a player's skin through the panel's
// same-origin proxy (/skin-image/:uuid), then crop the 8x8 face region (plus
// the hat layer, which sits at 40,8 in the texture) onto a canvas and upscale
// it into the row's avatar box. Same-origin means the canvas is never tainted.
//
// Each avatar box needs its own <img> so failures fall back to the existing
// initial/placeholder glyph without disturbing other rows.
//
// Skins are loaded through a bounded concurrency pool: firing a whole roster's
// worth of <img> src's at once is throttled by the browser's ~6 connections
// per origin, so requests pile up behind each other. A modest pool plus
// per-browser HTTP caching keeps a full players table snappy, and same-uuid
// loads within a page share one in-flight fetch.

const POOL_CONCURRENCY = 6;

const queue = []; // { key, task, resolve, reject }
const inflight = new Map(); // key -> promise
let active = 0;

function pump() {
  while (active < POOL_CONCURRENCY && queue.length) {
    const job = queue.shift();
    active += 1;
    const p = Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        active -= 1;
        if (job.key !== undefined) inflight.delete(job.key);
        pump();
      });
    if (job.key !== undefined) inflight.set(job.key, p);
  }
}

/**
 * Run a task with a bounded slot in the pool. Same `key` (unused or a uuid)
 * shares one in-flight run — a roster full of the same player fetches once.
 */
function pooled(key, task) {
  return new Promise((resolve, reject) => {
    queue.push({ key, task, resolve, reject });
    pump();
  });
}

/** Fetch one skin texture through the same-origin proxy (single <img>). */
function fetchSkinImage(serverId, uuid) {
  const url = `/api/servers/${serverId}/players/skin-image/${encodeURIComponent(uuid)}`;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('skin load failed'));
    image.src = url;
  });
}

export function renderPlayerHead(img, uuid, { serverId } = {}) {
  if (!img || !uuid || !serverId) return;
  const key = `${serverId}:${uuid}`;

  pooled(key, () => fetchSkinImage(serverId, uuid))
    .then((image) => {
      try {
        const size = 8;
        const scale = img.clientWidth || 32; // fall back if laid out at 0
        const canvas = document.createElement('canvas');
        canvas.width = size * scale;
        canvas.height = size * scale;
        const ctx = canvas.getContext('2d');
        // Face layer (8,8)-(16,16), then the hat overlay (40,8)-(48,16) on top.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 8, 8, size, size, 0, 0, size * scale, size * scale);
        ctx.drawImage(image, 40, 8, size, size, 0, 0, size * scale, size * scale);
        img.src = canvas.toDataURL('image/png');
        img.classList.add('player-head');
      } catch {
        /* canvas may be unavailable - keep the placeholder */
      }
    })
    .catch(() => {
      /* keep the placeholder glyph in the row */
    });
}
