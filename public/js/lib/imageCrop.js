// Square cropper for custom profile pictures. The picker (lib/avatar.js) hands
// us the file the user chose; we show it in a modal with a draggable /
// resizable square selection, then return just that square as a <= 512x512
// PNG/JPEG blob ready to POST to /api/account/avatar/upload.
//
//   openCropModal(file) -> Promise<{ blob, filename } | null>
//     resolves with the cropped square on "Use Photo",
//     or null on Cancel / Esc / an image that can't be decoded.
//
// SVG input is rasterized to a canvas first and then cropped like any raster,
// so what reaches the server is always PNG or JPEG - never vector.

import { openModal } from './modal.js';
import { toast } from './toast.js';
import { clampBox, resizeBox, pickExport, MIN_CROP_PX, OUTPUT_MAX_PX } from './cropMath.js';

const RASTER_MAX = 2048; // long-edge px cap for the crop source (SVG raster + oversized photos)
const SERVER_MAX_BYTES = 16 * 1024 * 1024; // must match the multer limit in routes/account.js

export function openCropModal(file) {
  return new Promise((resolve) => {
    let done = false;
    let objectUrl = null;
    const settle = (value) => {
      if (done) return;
      done = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      resolve(value);
    };

    normalizeSource(file)
      .then(({ img, url, sourceType }) => {
        objectUrl = url;
        const ui = buildUI(img);

        const wrap = document.createElement('div');
        wrap.className = 'space-y-3';
        const hint = document.createElement('p');
        hint.className = 'text-xs text-ink-faint';
        hint.textContent = 'Drag to move, drag a corner to resize. The square becomes your picture.';
        wrap.append(ui.root, hint);

        openModal({
          title: 'Crop Profile Picture',
          size: 'lg',
          content: wrap,
          actions: [
            { label: 'Cancel', kind: 'ghost' },
            {
              label: 'Use Photo',
              kind: 'primary',
              busyLabel: 'Processing…',
              onClick: async () => {
                try {
                  const result = await exportSquare(img, ui.getBox(), ui.getScale(), sourceType);
                  settle(result); // returning undefined lets modal.js close the modal
                } catch (err) {
                  toast(err.message || 'Could not process that image.', { kind: 'error' });
                  return false; // keep the modal open so the user can adjust
                }
              },
            },
          ],
          onClose: () => settle(null),
        });

        ui.init(); // openModal appended synchronously, so the <img> is measurable now
      })
      .catch(() => {
        toast('That image could not be opened.', { kind: 'error' });
        settle(null);
      });
  });
}

// --- source loading -------------------------------------------------------

// Resolve to a decoded raster <img> plus the source type that drives the export
// format. SVG is drawn to a canvas and handed back as a PNG. An oversized photo
// is downscaled the same way BEFORE it becomes a DOM <img> for the crop UI - a
// ~10k x 10k image decoded at natural size can crash a phone browser, and the
// <= 512px export never needs more than RASTER_MAX of source anyway.
async function normalizeSource(file) {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
  const sourceType = !isSvg && file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';

  if (!isSvg) {
    const rawUrl = URL.createObjectURL(file);
    let raw;
    try {
      raw = await decodeImage(rawUrl);
    } catch (err) {
      URL.revokeObjectURL(rawUrl);
      throw err;
    }
    if (Math.max(raw.naturalWidth, raw.naturalHeight) <= RASTER_MAX) {
      return { img: raw, url: rawUrl, sourceType };
    }
    const shrunk = await rasterizeDownscaled(raw, sourceType);
    URL.revokeObjectURL(rawUrl);
    return decodeToResult(shrunk, sourceType);
  }

  // Rasterize the SVG, then continue exactly as if a PNG had been picked.
  const svgUrl = URL.createObjectURL(file);
  let pngBlob;
  try {
    pngBlob = await rasterizeDownscaled(await decodeImage(svgUrl), 'image/png', { fallbackSize: 512 });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
  return decodeToResult(pngBlob, 'image/png');
}

// Draw `srcImg` into a canvas no larger than RASTER_MAX on its long edge and
// return it as a Blob of `type`. `fallbackSize` covers sizeless SVGs (0x0).
async function rasterizeDownscaled(srcImg, type, { fallbackSize = 0 } = {}) {
  let w = srcImg.naturalWidth || fallbackSize || RASTER_MAX;
  let h = srcImg.naturalHeight || fallbackSize || RASTER_MAX;
  const fit = Math.min(1, RASTER_MAX / Math.max(w, h));
  w = Math.max(1, Math.round(w * fit));
  h = Math.max(1, Math.round(h * fit));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff'; // JPEG has no alpha
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(srcImg, 0, 0, w, h);
  return canvasToBlob(canvas, type, type === 'image/jpeg' ? 0.92 : undefined);
}

async function decodeToResult(blob, sourceType) {
  const url = URL.createObjectURL(blob);
  try {
    return { img: await decodeImage(url), url, sourceType };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.naturalWidth >= 1 ? resolve(img) : reject(new Error('empty image')));
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

// --- crop UI ------------------------------------------------------------

function buildUI(img) {
  const root = document.createElement('div');
  root.className = 'relative mx-auto inline-block max-w-full select-none touch-none';

  const imgEl = document.createElement('img');
  imgEl.src = img.src;
  imgEl.alt = '';
  imgEl.draggable = false;
  imgEl.className = 'block max-h-[60vh] max-w-full w-auto h-auto';

  const boxEl = document.createElement('div');
  boxEl.dataset.cropBox = '';
  boxEl.className = 'absolute box-border cursor-move border-2 border-white/90';
  boxEl.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.5)';

  const handles = ['tl', 'tr', 'bl', 'br'].map((id) => {
    const h = document.createElement('div');
    h.dataset.handle = id;
    const cursor = id === 'tl' || id === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize';
    h.className = `absolute size-4 -m-2 rounded-sm bg-white shadow ${cursor}`;
    boxEl.appendChild(h);
    return h;
  });

  root.append(imgEl, boxEl);

  let dispW = 0;
  let dispH = 0;
  let scale = 1;
  let box = { x: 0, y: 0, size: 0 };

  function render() {
    boxEl.style.left = `${box.x}px`;
    boxEl.style.top = `${box.y}px`;
    boxEl.style.width = `${box.size}px`;
    boxEl.style.height = `${box.size}px`;
    for (const h of handles) {
      h.style.left = h.dataset.handle.includes('l') ? '0px' : '100%';
      h.style.top = h.dataset.handle.includes('t') ? '0px' : '100%';
    }
  }

  function init() {
    dispW = imgEl.clientWidth;
    dispH = imgEl.clientHeight;
    if (!dispW || !dispH) {
      requestAnimationFrame(init);
      return;
    }
    scale = img.naturalWidth / dispW;
    const size = Math.max(MIN_CROP_PX, Math.min(dispW, dispH));
    box = { x: (dispW - size) / 2, y: (dispH - size) / 2, size };
    render();
  }

  // One pointer handler for both move and resize; touch-none keeps the browser
  // from stealing the gesture for scroll/zoom.
  let active = null; // { mode, handle, startPt, startBox, rootRect }
  root.addEventListener('pointerdown', (e) => {
    const handleEl = e.target.closest('[data-handle]');
    const onBox = handleEl || e.target.closest('[data-crop-box]');
    if (!onBox) return;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    const rootRect = root.getBoundingClientRect();
    active = {
      mode: handleEl ? 'resize' : 'move',
      handle: handleEl
        ? { hx: handleEl.dataset.handle.includes('r') ? 1 : 0, hy: handleEl.dataset.handle.includes('b') ? 1 : 0 }
        : null,
      startPt: { x: e.clientX - rootRect.left, y: e.clientY - rootRect.top },
      startBox: { ...box },
      rootRect,
    };
  });

  root.addEventListener('pointermove', (e) => {
    if (!active) return;
    const p = { x: e.clientX - active.rootRect.left, y: e.clientY - active.rootRect.top };
    if (active.mode === 'move') {
      box = clampBox(
        {
          x: active.startBox.x + (p.x - active.startPt.x),
          y: active.startBox.y + (p.y - active.startPt.y),
          size: active.startBox.size,
        },
        dispW,
        dispH
      );
    } else {
      box = resizeBox(active.startBox, active.handle, p, dispW, dispH);
    }
    render();
  });

  const end = (e) => {
    if (!active) return;
    active = null;
    if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  return { root, init, getBox: () => ({ ...box }), getScale: () => scale };
}

// --- export -----------------------------------------------------------

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality);
  });
}

async function exportSquare(img, box, scale, sourceType) {
  // Selection back to natural pixels, clamped inside the image.
  const sx = Math.round(box.x * scale);
  const sy = Math.round(box.y * scale);
  let sSize = Math.round(box.size * scale);
  sSize = Math.min(sSize, img.naturalWidth - sx, img.naturalHeight - sy);
  if (sSize < 1) throw new Error('Pick a larger area to crop.');

  const out = Math.min(OUTPUT_MAX_PX, sSize);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  const drawTo = (flattenWhite) => {
    ctx.clearRect(0, 0, out, out);
    if (flattenWhite) {
      ctx.fillStyle = '#fff'; // JPEG has no alpha - flatten transparency to white, not black
      ctx.fillRect(0, 0, out, out);
    }
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, out, out);
  };

  let blob;
  let filename;
  if (sourceType === 'image/jpeg') {
    drawTo(true);
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    filename = 'avatar.jpg';
  } else {
    drawTo(false);
    const png = await canvasToBlob(canvas, 'image/png');
    const choice = pickExport('image/png', png.size);
    if (choice.type === 'image/png') {
      blob = png;
      filename = 'avatar.png';
    } else {
      drawTo(true);
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      filename = 'avatar.jpg';
    }
  }

  if (blob.size > SERVER_MAX_BYTES) {
    throw new Error('The cropped image is still too large. Try selecting a smaller area.');
  }
  return { blob, filename };
}
