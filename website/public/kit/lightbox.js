/*! SiteKit 1.0.0 | synced from anefzaoui/misterdownloadmanager website/kit/ | MIT License */
// The lightbox: pictures (and videos) over the page, a group at a time. It opens by flying the
// picture from its thumbnail (cropped thumbnails too) and closes back into it; goes through the
// group by arrows, keys, swipes and the wheel; zooms by double-click or double-tap, pinch, wheel
// or keys, and pans with clamped, springy edges; a downward swipe on a phone closes it. Back
// closes it, the focus comes back to the thumbnail, the page doesn't move. Reduced motion: fades.
//
// Markup: <img data-lightbox> or <a href="big.webp" data-lightbox="group"><img …></a> (a link
// keeps working with no script), a container with data-lightbox (its pictures are one group), or
// containers named by init({auto: ".prose"}). data-full, data-width/data-height, data-caption and
// data-lightbox-skip refine it. See README.md.
(function (w, d) {
  "use strict";
  var K = w.SiteKit;
  if (!K) return;
  var VIDEO = /\.(mp4|webm|ogv|mov|m4v)(?:[?#]|$)/i;
  var IMAGE = /\.(avif|webp|png|jpe?g|gif|svg|bmp)(?:[?#]|$)/i;
  var opt = {
    selector: "[data-lightbox]", auto: "", skip: "[data-lightbox-skip]", minWidth: 0, loop: true,
    wheel: "zoom", clickZoom: true, history: true, caption: null, size: null,
    onOpen: null, onChange: null, onClose: null
  };
  var GAP = 24;

  // ---- Which pictures, in which group --------------------------------------------------------
  function linkOf(img) { return img.closest("a[href]"); }
  function mediaLink(a) { return !!a && (IMAGE.test(a.getAttribute("href")) || VIDEO.test(a.getAttribute("href")) || a.hasAttribute("data-lightbox") || a.hasAttribute("data-full")); }
  function sizeOk(img) {
    var n = img.naturalWidth || +img.getAttribute("width") || 0;
    return !n || n >= opt.minWidth;
  }
  // A picture opens when it (or its link, or a container around it) says so, or when it sits in
  // an automatic container and isn't a link to a page.
  function joins(img) {
    if (!img || img.tagName !== "IMG" || img.closest(opt.skip) || !sizeOk(img)) return false;
    if (img.closest(opt.selector)) return true;
    return !!(opt.auto && img.closest(opt.auto) && (!linkOf(img) || mediaLink(linkOf(img))));
  }
  function laidOut(img) { return img.getClientRects().length > 0; }
  function group(img) {
    var named = img.closest(opt.selector), list = [];
    var name = named ? named.getAttribute("data-lightbox") : "";
    if (named && name) {
      var all = d.querySelectorAll("[data-lightbox]");
      for (var i = 0; i < all.length; i++) {
        if (all[i].getAttribute("data-lightbox") !== name) continue;
        if (all[i].tagName === "IMG") list.push(all[i]);
        else list.push.apply(list, all[i].querySelectorAll("img"));
      }
    } else if (named) {
      list = named.tagName === "IMG" ? [named] : Array.prototype.slice.call(named.querySelectorAll("img"));
    } else {
      var box = img.closest(opt.auto);
      list = Array.prototype.slice.call(box.querySelectorAll("img"));
    }
    return list.filter(function (i, k) {
      return list.indexOf(i) === k && (i === img || (joins(i) && laidOut(i)));
    });
  }

  function caption(img) {
    var c = img.getAttribute("data-caption") || (linkOf(img) && linkOf(img).getAttribute("data-caption"));
    if (c) return c;
    if (opt.caption) { c = opt.caption(img); if (c != null) return c; }
    var fig = img.closest("figure");
    var cap = fig && fig.querySelector("figcaption");
    return cap ? cap.textContent.replace(/\s+/g, " ").trim() : img.alt || "";
  }

  // What to show for a thumbnail: its source, its size in CSS pixels at 100%, whether that size
  // is known yet (else it comes from the picture once it loads), a picture or a video.
  function describe(img) {
    var a = linkOf(img);
    var href = a && a.getAttribute("href");
    var full = img.getAttribute("data-full") || (a && a.getAttribute("data-full"));
    var video = img.getAttribute("data-video") || (a && (a.getAttribute("data-type") === "video" || VIDEO.test(href)) ? a.href : "");
    if (!full && a && IMAGE.test(href)) full = a.href;
    var it = {
      thumb: img, trigger: a || img,
      type: video ? "video" : "image", src: video || full || img.currentSrc || img.src,
      srcset: !video && !full ? img.getAttribute("srcset") || "" : "",
      alt: img.alt || "", cap: caption(img), w: 0, h: 0, known: false
    };
    var dw = +(img.getAttribute("data-width") || (a && a.getAttribute("data-width"))), dh = +(img.getAttribute("data-height") || (a && a.getAttribute("data-height")));
    var s = opt.size ? opt.size(img) : null;
    if (s) { it.w = s[0]; it.h = s[1]; it.known = true; }
    else if (dw && dh) { it.w = dw; it.h = dh; it.known = true; }
    else if (!full && !video && img.naturalWidth) { it.w = img.naturalWidth; it.h = img.naturalHeight; it.known = true; }
    else {
      var aw = img.naturalWidth || +img.getAttribute("width") || img.offsetWidth || 4;
      var ah = img.naturalHeight || +img.getAttribute("height") || img.offsetHeight || 3;
      it.w = 8000; it.h = 8000 * ah / aw; // unknown: as large as the screen allows, until it loads
    }
    return it;
  }

  // ---- The viewer -----------------------------------------------------------------------------
  var dlg, track, live, countEl, capEl, hintEl, prevB, nextB, zoomB, closeB, slides = [];
  var items = [], at = 0, rtl = false, isOpen = false, busy = null, back = null, opener = null, bottom = 0;
  var z = { s: 1, x: 0, y: 0 };
  var ICONS = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    prev: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20M7.5 10.5h6M10.5 7.5v6"/>',
    unzoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20M7.5 10.5h6"/>'
  };
  function button(cls, icon) {
    var b = d.createElement("button");
    b.type = "button";
    b.className = "kit-lb-btn " + cls;
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[icon] + "</svg>";
    return b;
  }
  function el(tag, cls, parent) {
    var e = d.createElement(tag);
    e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function build() {
    if (dlg) return;
    dlg = el("dialog", "kit-lb", d.body);
    el("div", "kit-lb-bg", dlg);
    track = el("div", "kit-lb-track", dlg);
    for (var i = 0; i < 3; i++) slides.push({ el: el("div", "kit-lb-slide", track), m: null, i: -1 });
    var ui = el("div", "kit-lb-ui", dlg);
    var top = el("div", "kit-lb-top", ui);
    countEl = el("span", "kit-lb-count", top);
    countEl.setAttribute("aria-hidden", "true");
    var tools = el("div", "kit-lb-tools", top);
    zoomB = button("kit-lb-zoom", "zoom");
    closeB = button("kit-lb-close", "close");
    closeB.autofocus = true;
    tools.appendChild(zoomB);
    tools.appendChild(closeB);
    prevB = button("kit-lb-nav kit-lb-prev", "prev");
    nextB = button("kit-lb-nav kit-lb-next", "next");
    ui.appendChild(prevB);
    ui.appendChild(nextB);
    var foot = el("div", "kit-lb-foot", ui);
    capEl = el("p", "kit-lb-cap", foot);
    hintEl = el("span", "kit-lb-hint", foot);
    live = el("p", "kit-sr", ui);
    live.setAttribute("role", "status");
    closeB.addEventListener("click", function () { close(); });
    prevB.addEventListener("click", function () { go(-1); });
    nextB.addEventListener("click", function () { go(1); });
    zoomB.addEventListener("click", function () { toggleZoom(); });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    dlg.addEventListener("close", function () { if (isOpen) finish(); });
    dlg.addEventListener("keydown", keys);
    dlg.addEventListener("wheel", wheel, { passive: false });
    K.pointers(dlg, { down: down, move: move, up: up });
    w.addEventListener("resize", function () { if (isOpen) layout(true); });
  }

  // ---- Geometry -----------------------------------------------------------------------------
  function vw() { return dlg.clientWidth; }
  function vh() { return dlg.clientHeight; }
  // The room a picture has at rest: under the top bar, over the captions, clear of the sides.
  function area() {
    var pad = vw() < 640 ? 0 : 24, top = dlg.querySelector(".kit-lb-top").offsetHeight;
    return { x: pad, y: top, w: vw() - pad * 2, h: Math.max(80, vh() - top - bottom) };
  }
  function fitOf(it) {
    var a = area();
    var s = Math.min(1, a.w / it.w, a.h / it.h);
    return { s: s, x: a.x + (a.w - it.w * s) / 2, y: a.y + (a.h - it.h * s) / 2 };
  }
  function cur() { return items[at]; }
  function fit() { return fitOf(cur()).s; }
  function target() { var f = fit(); return f >= 0.5 ? Math.max(1, f * 2) : f * 2.5; }
  function maxS() { return Math.max(2, target() * 2); }
  function zoomed() { return z.s > fit() * 1.01; }
  // Pan limits: a picture wider (taller) than the screen keeps its edges outside it; a narrower
  // one stays centred in its room. `give` lets it run past by a damped amount while dragged.
  function clamp(q, give) {
    var it = cur(), a = area(), W = it.w * q.s, H = it.h * q.s;
    function axis(v, size, room0, room, full) {
      if (size <= room) return room0 + (room - size) / 2;
      var lo = full - size, hi = 0;
      if (v > hi) return give ? hi + (v - hi) * 0.35 : hi;
      if (v < lo) return give ? lo + (v - lo) * 0.35 : lo;
      return v;
    }
    return { s: q.s, x: axis(q.x, W, a.x, a.w, vw()), y: axis(q.y, H, a.y, a.h, vh()) };
  }
  function tf(q) { return "translate3d(" + q.x + "px," + q.y + "px,0) scale(" + q.s + ")"; }
  function place(m, q, ms) {
    if (!m) return;
    m.style.transition = ms ? "transform " + ms + "ms " + K.ease() : "";
    m.style.transform = tf(q);
  }
  var wasOn = null;
  function setZ(q, ms) {
    z = q;
    place(slides[1].m, z, ms);
    var on = zoomed();
    if (on !== wasOn) {
      wasOn = on;
      dlg.classList.toggle("kit-lb-zoomed", on);
      zoomB.setAttribute("aria-label", K.text(on ? "zoomOut" : "zoomIn"));
      zoomB.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[on ? "unzoom" : "zoom"] + "</svg>";
    }
    if (on && slides[1].m && cur().srcset) slides[1].m.sizes = Math.ceil(cur().w * z.s) + "px";
  }
  function zoomTo(s, cx, cy, ms) {
    var a = area();
    if (cx == null) { cx = a.x + a.w / 2; cy = a.y + a.h / 2; }
    s = Math.max(fit(), Math.min(maxS(), s));
    var k = s / z.s;
    setZ(clamp({ s: s, x: cx - (cx - z.x) * k, y: cy - (cy - z.y) * k }), ms);
  }
  function toggleZoom(cx, cy) {
    if (cur().type !== "image") return;
    var ms = K.reduced() ? 0 : 300;
    if (zoomed()) setZ(fitOf(cur()), ms);
    else zoomTo(target(), cx, cy, ms);
  }

  // The thumbnail's picture on the page, as a transform of the full one plus the clip of what
  // shows (object-fit: cover crops it), so the flight starts and ends exactly on it.
  function boxOf(img, it) {
    var r = img.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var cs = getComputedStyle(img), f = cs.objectFit;
    var l = parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), t = parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
    var cw = r.width - l - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    var ch = r.height - t - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
    var cx = r.left + l, cy = r.top + t, s, x, y;
    if (f === "cover" || f === "contain" || f === "scale-down") {
      s = f === "cover" ? Math.max(cw / it.w, ch / it.h) : Math.min(cw / it.w, ch / it.h);
      var pos = cs.objectPosition.split(" ");
      var off = function (v, room) { return /%$/.test(v) ? room * parseFloat(v) / 100 : parseFloat(v) || 0; };
      x = cx + off(pos[0], cw - it.w * s);
      y = cy + off(pos[1] || "50%", ch - it.h * s);
    } else { s = cw / it.w; x = cx; y = cy; }
    // Rounded by itself, or by the box around it that clips it (a rounded link or frame).
    var R = parseFloat(cs.borderTopLeftRadius) || 0, up = img.parentElement;
    if (!R && up && getComputedStyle(up).overflow !== "visible") R = parseFloat(getComputedStyle(up).borderTopLeftRadius) || 0;
    R /= s;
    var c = [cy - y, x + it.w * s - cx - cw, y + it.h * s - cy - ch, cx - x].map(function (v) { return Math.max(0, v / s) + "px"; });
    return { q: { s: s, x: x, y: y }, clip: "inset(" + c.join(" ") + " round " + R + "px)" };
  }
  // No clip at all, in the clip's own terms: room for the picture's shadow (the clip grows out to
  // it, so the shadow arrives with the picture rather than at the end).
  function wide(s) { var v = -200 / s + "px"; return "inset(" + [v, v, v, v].join(" ") + " round 0px)"; }
  // On screen and not faded out or hidden: worth flying to.
  function shown(img) {
    if (!img || !img.isConnected) return false;
    var r = img.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > w.innerHeight || r.right < 0 || r.left > w.innerWidth) return false;
    for (var e = img; e && e.nodeType === 1; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (+cs.opacity < 0.05 || cs.visibility === "hidden") return false;
    }
    return true;
  }

  // ---- Slides ---------------------------------------------------------------------------------
  function index(k) {
    var n = items.length, i = at + k;
    if (n < 2 && k) return -1;
    if (opt.loop) return (i % n + n) % n;
    return i >= 0 && i < n ? i : -1;
  }
  function fill(sl, i) {
    if (sl.i === i && sl.m) return;
    sl.i = i;
    sl.el.textContent = "";
    sl.el.className = "kit-lb-slide";
    sl.m = null;
    if (i < 0) return;
    var it = items[i], m;
    if (it.type === "video") {
      m = d.createElement("video");
      m.controls = true;
      m.playsInline = true;
      m.preload = "metadata";
      if (it.thumb.currentSrc) m.poster = it.thumb.currentSrc;
      m.src = it.src;
      m.addEventListener("loadedmetadata", function () { sized(it, m.videoWidth, m.videoHeight); });
    } else {
      m = d.createElement("img");
      m.alt = it.alt;
      m.decoding = "async";
      m.draggable = false;
      var ph = it.thumb.complete && it.thumb.naturalWidth ? it.thumb.currentSrc || it.thumb.src : "";
      var loaded = function () { sl.el.classList.remove("kit-lb-loading"); sized(it, m.naturalWidth, m.naturalHeight); };
      m.addEventListener("load", loaded);
      m.addEventListener("error", function () { if (!ph) sl.el.classList.add("kit-lb-error"); sl.el.classList.remove("kit-lb-loading"); });
      if (ph && (ph !== it.src || it.srcset)) {
        // The thumbnail at once (it's cached), the full picture once it has arrived and decoded.
        m.src = ph;
        var pre = new Image();
        if (it.srcset) { pre.sizes = Math.ceil(area().w) + "px"; pre.srcset = it.srcset; }
        pre.src = it.src;
        var swap = function () {
          if (sl.i !== i || sl.m !== m) return;
          if (it.srcset) { m.sizes = pre.sizes; m.srcset = it.srcset; }
          m.src = it.src;
        };
        if (pre.decode) pre.decode().then(swap, function () {});
        else pre.onload = swap;
      } else {
        if (it.srcset) { m.sizes = Math.ceil(area().w) + "px"; m.srcset = it.srcset; }
        m.src = it.src;
        if (!m.complete) {
          setTimeout(function () { if (sl.m === m && !m.complete) sl.el.classList.add("kit-lb-loading"); }, 250);
        }
      }
    }
    m.className = "kit-lb-media";
    m.style.width = it.w + "px";
    m.style.height = it.h + "px";
    sl.m = m;
    sl.el.appendChild(m);
    var t = d.createElement("span");
    t.className = "kit-lb-alt";
    t.textContent = it.alt;
    sl.el.appendChild(t);
    place(m, fitOf(it));
  }
  // The real size, once the picture or video says it (when the page didn't).
  function sized(it, nw, nh) {
    if (it.known || !nw || !nh) return;
    it.w = nw; it.h = nh; it.known = true;
    for (var k = 0; k < 3; k++) {
      var s = slides[k];
      if (s.i < 0 || items[s.i] !== it || !s.m) continue;
      s.m.style.width = nw + "px";
      s.m.style.height = nh + "px";
      if (k === 1) setZ(fitOf(it)); else place(s.m, fitOf(it));
    }
  }
  function position(dx) {
    var step = vw() + GAP;
    for (var k = 0; k < 3; k++) slides[k].el.style.transform = "translate3d(" + ((k - 1) * step * (rtl ? -1 : 1)) + "px,0,0)";
    track.style.transform = "translate3d(" + (dx || 0) + "px,0,0)";
  }
  function layout(again) {
    settle();
    measureCaptions();
    for (var k = 0; k < 3; k++) {
      if (slides[k].i < 0) continue;
      if (!again) fill(slides[k], slides[k].i);
      if (slides[k].m) place(slides[k].m, fitOf(items[slides[k].i]));
    }
    position(0);
    if (slides[1].m) setZ(fitOf(cur()));
  }
  // The captions' room is the tallest one's, so the pictures don't jump as they change.
  function measureCaptions() {
    var keep = capEl.textContent, h = 0;
    for (var i = 0; i < items.length && i < 60; i++) {
      capEl.textContent = items[i].cap;
      h = Math.max(h, capEl.parentNode.offsetHeight);
    }
    capEl.textContent = keep;
    bottom = Math.max(h, 16);
  }

  function update() {
    var it = cur(), n = items.length;
    countEl.textContent = n > 1 ? (at + 1) + " / " + n : "";
    capEl.textContent = it.cap;
    var hint = K.text("hint");
    hintEl.textContent = it.type === "image" ? hint : "";
    prevB.hidden = nextB.hidden = n < 2;
    prevB.disabled = !opt.loop && at === 0;
    nextB.disabled = !opt.loop && at === n - 1;
    zoomB.hidden = it.type !== "image";
    dlg.classList.toggle("kit-lb-video", it.type === "video");
    var say = n > 1 ? K.text("counter", { n: at + 1, total: n }) : "";
    live.textContent = say + (say && it.alt ? ". " : "") + it.alt;
    for (var k = 0; k < 3; k++) {
      var m = slides[k].m;
      if (m && m.tagName === "VIDEO") { if (k === 1) { var p = m.play(); if (p && p.catch) p.catch(function () {}); } else m.pause(); }
      slides[k].el.setAttribute("aria-hidden", k === 1 ? "false" : "true");
    }
    if (opt.onChange) opt.onChange(it.thumb, at);
  }

  function settle() { if (busy) { busy(); busy = null; } }

  // Moves through the group: the slides slide (from where a swipe left them), then the three
  // are dealt again around the new one. Home/End and reduced motion swap with a fade.
  function go(k, fromDx) {
    if (!isOpen || items.length < 2) return;
    settle();
    var i = index(k);
    if (i < 0) { position(0); return; }
    var near = Math.abs(k) === 1 && !K.reduced();
    var dir = k > 0 ? 1 : -1;
    if (!near) return jump(i);
    var step = (vw() + GAP) * dir * (rtl ? 1 : -1);
    var from = fromDx || 0;
    var ms = Math.max(160, Math.min(380, 380 * Math.abs(step - from) / Math.abs(step)));
    track.style.transition = "transform " + ms + "ms " + K.ease();
    track.style.transform = "translate3d(" + step + "px,0,0)";
    var t = setTimeout(done, ms + 40);
    function done() {
      clearTimeout(t);
      if (busy === done) busy = null;
      track.style.transition = "";
      var old = slides;
      slides = dir > 0 ? [old[1], old[2], old[0]] : [old[2], old[0], old[1]];
      at = i;
      // The picture that left goes back to its fitted size, for when it comes back.
      var left = slides[dir > 0 ? 0 : 2];
      if (left.m) place(left.m, fitOf(items[left.i]));
      fill(slides[dir > 0 ? 2 : 0], index(dir));
      z = fitOf(cur());
      position(0);
      setZ(z);
      update();
    }
    busy = done;
  }
  function jump(i) {
    settle();
    at = i;
    for (var k = 0; k < 3; k++) slides[k].i = -2;
    fill(slides[1], at); fill(slides[0], index(-1)); fill(slides[2], index(1));
    z = fitOf(cur());
    position(0);
    setZ(z);
    update();
    if (slides[1].m) K.animate(slides[1].m, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
  }

  // ---- Open and close ---------------------------------------------------------------------------
  function open(img) {
    build();
    if (isOpen) return;
    var list = group(img);
    items = list.map(describe);
    at = Math.max(0, list.indexOf(img));
    opener = items[at].trigger;
    // The page's direction (its dir attribute), not the picture's: sites often keep screenshots
    // left to right on a right-to-left page.
    var dirEl = img.closest("[dir]");
    rtl = dirEl ? dirEl.getAttribute("dir").toLowerCase() === "rtl" : K.rtl(d.documentElement);
    isOpen = true;
    K.lock();
    dlg.setAttribute("dir", rtl ? "rtl" : "ltr");
    dlg.setAttribute("aria-label", K.text("viewer"));
    closeB.setAttribute("aria-label", K.text("close"));
    prevB.setAttribute("aria-label", K.text("prev"));
    nextB.setAttribute("aria-label", K.text("next"));
    dlg.classList.remove("kit-lb-quiet", "kit-lb-zoomed");
    dlg.classList.toggle("kit-lb-click", opt.clickZoom);
    dlg.showModal();
    for (var k = 0; k < 3; k++) slides[k].i = -2;
    measureCaptions();
    fill(slides[1], at); fill(slides[0], index(-1)); fill(slides[2], index(1));
    position(0);
    z = fitOf(cur());
    setZ(z);
    update();
    if (opt.history) back = K.backEntry(function () { back = null; close(); });
    if (opt.onOpen) opt.onOpen(img, at);
    // The flight: from the thumbnail to its place, the backdrop and the controls fading in.
    var it = cur(), m = slides[1].m, ms = K.ms("--kit-dur", 320);
    var box = !K.reduced() && shown(it.thumb) && boxOf(it.thumb, it);
    fade(dlg.querySelector(".kit-lb-bg"), 0, 1, K.reduced() ? 160 : ms * 0.8);
    fade(dlg.querySelector(".kit-lb-ui"), 0, 1, K.reduced() ? 160 : ms);
    if (box) {
      hide(it.thumb, true);
      K.animate(m, [{ transform: tf(box.q), clipPath: box.clip }, { transform: tf(z), clipPath: wide(z.s) }],
        { duration: ms, easing: K.ease() }).then(function () { if (!closing) hide(it.thumb, false); });
    } else if (!K.reduced()) {
      K.animate(m, [{ opacity: 0, transform: tf({ s: z.s * 0.94, x: z.x + it.w * z.s * 0.03, y: z.y + it.h * z.s * 0.03 }) }, { opacity: 1, transform: tf(z) }], { duration: ms, easing: K.ease() });
    } else {
      K.animate(m, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
    }
  }
  // keep: hold the end (closing); otherwise the element's own style takes over at the end.
  function fade(e, a, b, ms, keep) { return K.animate(e, [{ opacity: a }, { opacity: b }], { duration: ms, easing: "ease-out", fill: keep ? "forwards" : "none" }); }
  function hide(img, on) {
    if (on) { if (!("_kitVis" in img)) img._kitVis = img.style.visibility; img.style.visibility = "hidden"; }
    else if ("_kitVis" in img) { img.style.visibility = img._kitVis; delete img._kitVis; }
  }

  var closing = false;
  function close() {
    if (!isOpen || closing) return;
    closing = true;
    settle();
    if (back) { var b = back; back = null; b.release(); }
    var it = cur(), m = slides[1].m, ms = K.ms("--kit-dur-out", 260);
    if (m && m.tagName === "VIDEO") m.pause();
    // From wherever the picture is now (zoomed, dragged down) back into its thumbnail.
    var now = m ? (getComputedStyle(m).transform) : "";
    var box = m && !K.reduced() && shown(it.thumb) && boxOf(it.thumb, it);
    var bg = dlg.querySelector(".kit-lb-bg"), ui = dlg.querySelector(".kit-lb-ui");
    var o = +getComputedStyle(bg).opacity;
    var anims = [fade(bg, o, 0, K.reduced() ? 140 : ms, true), fade(ui, +getComputedStyle(ui).opacity, 0, 120, true)];
    if (box) {
      hide(it.thumb, true);
      m.style.transition = "";
      anims.push(K.animate(m, [{ transform: now, clipPath: wide(z.s) }, { transform: tf(box.q), clipPath: box.clip }],
        { duration: ms, easing: K.ease(), fill: "forwards" }));
    } else if (m) {
      anims.push(K.animate(m, [{ opacity: +getComputedStyle(m).opacity }, { opacity: 0 }], { duration: K.reduced() ? 140 : ms * 0.8, easing: "ease-out", fill: "forwards" }));
    }
    Promise.all(anims).then(function () { if (dlg.open) dlg.close(); else finish(); });
  }
  // Closed (by close() or by the browser itself): everything put back as it was.
  function finish() {
    if (!isOpen) return;
    isOpen = false;
    closing = false;
    if (back) { var b = back; back = null; b.release(); }
    var it = cur();
    hide(it.thumb, false);
    for (var k = 0; k < 3; k++) {
      var m = slides[k].m;
      if (m && m.getAnimations) m.getAnimations().forEach(function (a) { a.cancel(); });
      if (m && m.tagName === "VIDEO") m.pause();
      slides[k].el.textContent = "";
      slides[k].m = null;
      slides[k].i = -2;
    }
    [".kit-lb-bg", ".kit-lb-ui"].forEach(function (s) {
      var e = dlg.querySelector(s);
      e.style.opacity = "";
      if (e.getAnimations) e.getAnimations().forEach(function (a) { a.cancel(); });
    });
    wasOn = null;
    K.unlock();
    var t = it.trigger;
    if (!(shown(it.thumb) && K.focus(t))) K.focus(opener);
    if (opt.onClose) opt.onClose(it.thumb, at);
  }

  // ---- Keys, wheel, pointers -----------------------------------------------------------------
  function keys(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var inMedia = e.target && e.target.tagName === "VIDEO";
    var k = e.key, f = rtl ? -1 : 1;
    if (k === "Escape") { e.preventDefault(); close(); return; }
    if (inMedia && /^Arrow|Home|End/.test(k)) return;
    var map = { ArrowRight: function () { go(f); }, ArrowLeft: function () { go(-f); },
      Home: function () { if (at) jump(0); }, End: function () { if (at !== items.length - 1) jump(items.length - 1); },
      "+": function () { zoomTo(Math.max(z.s * 1.5, zoomed() ? 0 : target()), null, null, 200); }, "=": function () { map["+"](); },
      "-": function () { zoomTo(z.s / 1.5, null, null, 200); }, "0": function () { setZ(fitOf(cur()), 200); } };
    if (map[k]) { e.preventDefault(); if (isOpen && !closing) map[k](); }
  }
  var wheelAt = 0;
  function wheel(e) {
    if (!isOpen || closing || (e.target.closest && e.target.closest(".kit-lb-foot"))) return;
    e.preventDefault();
    if (cur().type !== "image") return;
    if (opt.wheel === "zoom" || e.ctrlKey) {
      var k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      zoomTo(z.s * k, e.clientX, e.clientY);
    } else if (opt.wheel === "nav" && Date.now() - wheelAt > 450 && Math.abs(e.deltaY) + Math.abs(e.deltaX) > 20) {
      wheelAt = Date.now();
      go((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 1 : -1);
    }
  }

  var g = null, lastTap = null, tapTimer = 0;
  function down(e, list) {
    if (!isOpen || closing) return false;
    var t = e.target;
    // A video keeps its own controls: a mouse leaves it alone, a finger is followed without being
    // caught (catching it would take the tap from the play button), so a swipe still goes on.
    var onVideo = t.tagName === "VIDEO";
    if (t.closest("button, a, .kit-lb-foot") || (onVideo && e.pointerType === "mouse")) return false;
    settle();
    var m = slides[1].m;
    if (m) m.style.transition = "";
    track.style.transition = "";
    if (list.length === 2) {
      if (cur().type !== "image") return false;
      if (g && g.mode === "swipe") { track.style.transition = "transform 200ms " + K.ease(); position(0); }
      var a = list[0], b = list[1];
      g = { mode: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, z0: { s: z.s, x: z.x, y: z.y } };
    } else if (list.length === 1) {
      g = { mode: null, z0: { s: z.s, x: z.x, y: z.y }, type: e.pointerType, video: onVideo };
    } else return false;
    if (onVideo) return "free";
  }
  function move(e, list) {
    if (!g || closing) return;
    if (g.mode === "pinch") {
      if (list.length < 2) return;
      var a = list[0], b = list[1];
      var dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var s = g.z0.s * dist / g.d0, lo = fit(), hi = maxS();
      if (s > hi) s = hi * Math.pow(s / hi, 0.3);
      if (s < lo) s = lo * Math.pow(s / lo, 0.4);
      var k = s / g.z0.s;
      z = { s: s, x: mx - (g.mx - g.z0.x) * k, y: my - (g.my - g.z0.y) * k };
      place(slides[1].m, z);
      return;
    }
    var p = list[0];
    if (!p) return;
    var dx = p.x - p.x0, dy = p.y - p.y0;
    if (!g.mode) {
      if (Math.abs(dx) + Math.abs(dy) < 8) return;
      clearTimeout(tapTimer);
      if (zoomed()) g.mode = "pan";
      else if (Math.abs(dx) >= Math.abs(dy) || g.type === "mouse") g.mode = items.length > 1 ? "swipe" : "none";
      else g.mode = "drop";
      dlg.classList.add("kit-lb-dragging");
    }
    if (g.mode === "pan") setZ(clamp({ s: z.s, x: g.z0.x + dx, y: g.z0.y + dy }, true));
    else if (g.mode === "swipe") {
      var edge = !opt.loop && index(dx * (rtl ? 1 : -1) > 0 ? 1 : -1) < 0;
      track.style.transform = "translate3d(" + (edge ? dx * 0.35 : dx) + "px,0,0)";
    } else if (g.mode === "drop") {
      var pull = Math.min(1, Math.abs(dy) / (vh() * 0.5));
      var s2 = g.z0.s * (1 - pull * 0.25), it = cur();
      place(slides[1].m, { s: s2, x: g.z0.x + dx + it.w * (g.z0.s - s2) / 2, y: g.z0.y + dy + it.h * (g.z0.s - s2) / 2 });
      dlg.querySelector(".kit-lb-bg").style.opacity = String(1 - pull * 0.85);
      dlg.querySelector(".kit-lb-ui").style.opacity = String(1 - pull * 2);
    }
  }
  function up(_e, list, p, cancelled) {
    if (!g) return;
    dlg.classList.remove("kit-lb-dragging");
    var ms = K.reduced() ? 0 : 280;
    if (g.mode === "pinch") {
      // Back inside the limits, around where the fingers were; the finger left over pans.
      var s = Math.max(fit(), Math.min(maxS(), z.s));
      var a = list[0], b = list[1] || list[0];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, k = s / z.s;
      setZ(clamp({ s: s, x: mx - (mx - z.x) * k, y: my - (my - z.y) * k }), ms);
      g = list.length > 2 ? g : { mode: "done" };
      return;
    }
    if (list.length > 1) return;
    var dx = p.x - p.x0, dy = p.y - p.y0, mode = g.mode, video = g.video;
    g = null;
    if (cancelled) { position(0); setZ(clamp(z), ms); return; }
    if (!mode) return video ? undefined : tap(p);
    if (mode === "pan") {
      // A short glide in the direction it was thrown.
      setZ(clamp({ s: z.s, x: z.x + p.vx * 160, y: z.y + p.vy * 160 }), ms ? 420 : 0);
    } else if (mode === "swipe") {
      var far = Math.abs(dx) > vw() * 0.18 || (Math.abs(p.vx) > 0.35 && Math.abs(dx) > 24);
      var k2 = (dx < 0) !== rtl ? 1 : -1;
      if (far && index(k2) >= 0) go(k2, dx);
      else { track.style.transition = "transform " + (ms || 1) + "ms " + K.ease(); position(0); }
    } else if (mode === "drop") {
      if (Math.abs(dy) > 90 || Math.abs(p.vy) > 0.5) close();
      else {
        place(slides[1].m, z, ms);
        [".kit-lb-bg", ".kit-lb-ui"].forEach(function (s) {
          var e = dlg.querySelector(s), o = Math.max(0, +e.style.opacity);
          e.style.opacity = "";
          fade(e, o, 1, ms || 1);
        });
      }
    }
  }
  // A tap or click: on the picture it zooms (a click, or a double tap), or shows and hides the
  // controls (a single tap); beside it, it closes.
  function tap(p) {
    var onMedia = !!slides[1].m && hit(p);
    var now = Date.now();
    var dbl = lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30;
    lastTap = dbl ? null : { t: now, x: p.x, y: p.y };
    if (p.type === "mouse") {
      if (!onMedia) return close();
      // A click zooms (or, without clickZoom, a double click); a double click's second click
      // doesn't undo the first.
      if (opt.clickZoom ? !dbl : dbl) toggleZoom(p.x, p.y);
      return;
    }
    clearTimeout(tapTimer);
    if (dbl) { if (onMedia) toggleZoom(p.x, p.y); return; }
    tapTimer = setTimeout(function () {
      if (!isOpen) return;
      if (onMedia) dlg.classList.toggle("kit-lb-quiet");
      else close();
    }, 260);
  }
  function hit(p) {
    var r = slides[1].m.getBoundingClientRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }

  // ---- The page's pictures ------------------------------------------------------------------
  // Pictures that open are marked (zoom cursor); one that isn't a link becomes a button for the
  // keyboard and screen readers. Clicks are caught on the document, so pictures added later work.
  function scan(rootEl) {
    var imgs = (rootEl || d).querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!joins(img)) continue;
      img.classList.add("kit-lb-zoomable");
      var a = linkOf(img);
      if (a) { a.setAttribute("aria-haspopup", "dialog"); continue; }
      if (!img.hasAttribute("tabindex")) img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-haspopup", "dialog");
    }
  }
  function pick(t) {
    if (!t || !t.closest) return null;
    var img = t.tagName === "IMG" ? t : null;
    if (!img) { var a = t.closest("a[href]"); img = a && a.querySelector("img"); }
    return joins(img) ? img : null;
  }
  var inited = false;
  function init(o) {
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) opt[k] = o[k];
    scan();
    if (inited) return;
    inited = true;
    d.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      var img = pick(e.target);
      if (!img || (dlg && dlg.contains(img))) return;
      e.preventDefault();
      open(img);
    });
    d.addEventListener("keydown", function (e) {
      if ((e.key !== "Enter" && e.key !== " ") || e.target.tagName !== "IMG" || e.target.getAttribute("role") !== "button") return;
      var img = pick(e.target);
      if (!img) return;
      e.preventDefault();
      open(img);
    });
  }

  K.lightbox = {
    init: init,
    scan: scan,
    open: function (img) { if (joins(img)) open(img); },
    close: close,
    isOpen: function () { return isOpen; },
    index: function () { return at; }
  };
})(window, document);
