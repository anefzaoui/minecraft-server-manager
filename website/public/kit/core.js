/*! SiteKit 1.0.1 | synced from anefzaoui/misterdownloadmanager website/kit/ | MIT License */
// The kit's shared helpers: its words, motion, direction, the page's scroll lock, the Back
// button, pointer gestures and focus. lightbox.js and modal.js use them; a site may too.
// Plain script, no build step: it sets window.SiteKit. See README.md for the API.
(function (w, d) {
  "use strict";
  var K = w.SiteKit = w.SiteKit || {};
  var root = d.documentElement;
  K.version = "1.0.1";

  // ---- Words --------------------------------------------------------------------------------
  // English by default; a site hands its own language's words to setStrings() before or after
  // init. "{n}" style placeholders are filled by text(key, {n: 3}).
  var words = {
    viewer: "Image viewer",
    close: "Close",
    prev: "Previous image",
    next: "Next image",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    counter: "{n} of {total}",
    hint: ""
  };
  K.setStrings = function (s) {
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k) && s[k] != null && s[k] !== "") words[k] = String(s[k]);
  };
  K.text = function (key, vars) {
    return String(words[key] == null ? key : words[key]).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && k in vars ? vars[k] : m;
    });
  };

  // ---- Motion and direction ------------------------------------------------------------------
  var calm = w.matchMedia ? w.matchMedia("(prefers-reduced-motion: reduce)") : null;
  // Asked for less motion: fades only, nothing flies or slides.
  K.reduced = function () { return !!(calm && calm.matches) || root.hasAttribute("data-kit-reduce"); };
  // A motion token from CSS (--kit-dur: 320ms or .32s), in milliseconds.
  K.ms = function (name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    var n = parseFloat(v);
    if (isNaN(n)) return fallback;
    return /ms$/.test(v) ? n : n * 1000;
  };
  K.ease = function () {
    return getComputedStyle(root).getPropertyValue("--kit-ease").trim() || "cubic-bezier(.16, 1, .3, 1)";
  };
  K.rtl = function (el) { return getComputedStyle(el || root).direction === "rtl"; };

  // Runs a Web Animation and resolves when it ends (at once where there is none).
  K.animate = function (el, frames, opts) {
    if (!el.animate || !opts.duration) return Promise.resolve();
    var a = el.animate(frames, opts);
    return a.finished.then(function () { return a; }, function () { return a; });
  };

  // ---- Scroll lock ---------------------------------------------------------------------------
  // Counted, so a modal over the lightbox (or over another modal) unlocks only when the last one
  // closes. The scrollbar's room is kept (scrollbar-gutter, or padding where that's missing), so
  // nothing on the page moves sideways when it locks. A body with overflow-x: hidden (common, to
  // clip what pokes out) would turn into a scroll box of its own once the root's overflow stops
  // standing for the page's, and a sticky header would drop out of view: the body is made
  // visible meanwhile, the root clipping both ways as it did.
  var locks = 0, saved = null;
  K.lock = function () {
    if (locks++) return;
    var bar = w.innerWidth - root.clientWidth;
    var cs = getComputedStyle(root), bs = getComputedStyle(d.body);
    saved = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter, pad: d.body.style.paddingInlineEnd, body: null };
    if (cs.overflowX === "visible" && cs.overflowY === "visible" && /hidden|auto|scroll/.test(bs.overflowX + bs.overflowY)) {
      saved.body = d.body.style.overflow;
      d.body.style.overflow = "visible";
    }
    if (bar > 0) {
      if (w.CSS && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) {
        if (cs.scrollbarGutter.indexOf("stable") < 0) root.style.scrollbarGutter = "stable";
      } else {
        var pad = parseFloat(getComputedStyle(d.body).paddingInlineEnd) || 0;
        d.body.style.paddingInlineEnd = pad + bar + "px";
      }
    }
    root.style.setProperty("--kit-scrollbar", bar + "px");
    root.style.overflow = "hidden";
    root.classList.add("kit-locked");
  };
  K.unlock = function () {
    if (!locks || --locks) return;
    root.style.overflow = saved.overflow;
    root.style.scrollbarGutter = saved.gutter;
    if (saved.body !== null) d.body.style.overflow = saved.body;
    d.body.style.paddingInlineEnd = saved.pad;
    root.style.removeProperty("--kit-scrollbar");
    root.classList.remove("kit-locked");
  };

  // ---- The Back button ------------------------------------------------------------------------
  // An open layer (the lightbox, a modal) adds one history entry, so a phone's Back closes it
  // instead of leaving the page. Closing it any other way takes the entry back out.
  var layers = [], skip = 0, seq = 0;
  w.addEventListener("popstate", function () {
    if (skip) { skip--; return; }
    var top = layers.pop();
    if (top) top.fn();
  });
  K.backEntry = function (fn) {
    var h = { fn: fn, id: ++seq };
    try {
      var state = {};
      var cur = history.state;
      if (cur && typeof cur === "object") for (var k in cur) state[k] = cur[k];
      state.kitLayer = h.id;
      history.pushState(state, "");
    } catch (e) { return { release: function () {} }; }
    layers.push(h);
    h.release = function () {
      var i = layers.indexOf(h);
      if (i < 0) return;
      layers.splice(i, 1);
      if (history.state && history.state.kitLayer === h.id) { skip++; history.back(); }
    };
    return h;
  };

  // ---- Focus ---------------------------------------------------------------------------------
  K.focus = function (el) {
    if (!el || !el.focus || !d.contains(el)) return false;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    return d.activeElement === el;
  };

  // ---- Pointers ------------------------------------------------------------------------------
  // Every pointer on `el`, tracked from down to up: its start, where it is, how fast it moves
  // (px/ms, over the last 100 ms). h.down/move/up(e, list) get the live list; returning false
  // from down ignores that pointer, "free" tracks it without capturing it (the element under it,
  // a video's controls say, still gets its own events).
  K.pointers = function (el, h) {
    var list = [];
    function find(id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
    function track(p, e) {
      var now = e.timeStamp || Date.now();
      p.trail.push([now, e.clientX, e.clientY]);
      while (p.trail.length > 2 && now - p.trail[0][0] > 100) p.trail.shift();
      p.x = e.clientX; p.y = e.clientY;
      var a = p.trail[0], dt = Math.max(1, now - a[0]);
      p.vx = (p.x - a[1]) / dt; p.vy = (p.y - a[2]) / dt;
    }
    el.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      var p = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t0: e.timeStamp || Date.now(), trail: [], target: e.target };
      track(p, e);
      list.push(p);
      var r = h.down ? h.down(e, list) : true;
      if (r === false) { list.pop(); return; }
      if (r !== "free") try { el.setPointerCapture(e.pointerId); } catch (x) { /* already gone */ }
    });
    el.addEventListener("pointermove", function (e) {
      var p = find(e.pointerId);
      if (!p) return;
      track(p, e);
      if (h.move) h.move(e, list);
    });
    function end(e) {
      var p = find(e.pointerId);
      if (!p) return;
      track(p, e);
      if (h.up) h.up(e, list, p, e.type === "pointercancel");
      list.splice(list.indexOf(p), 1);
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return { reset: function () { list.length = 0; } };
  };
})(window, document);
