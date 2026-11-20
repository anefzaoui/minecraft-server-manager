/*! SiteKit 1.0.2 | synced from anefzaoui/misterdownloadmanager website/kit/ | MIT License */
// Modals on the browser's own <dialog> (showModal: the page behind is inert, the focus stays
// inside, the top layer stacks one over another). The kit adds what the element lacks: entry and
// exit transitions, a click on the backdrop and Escape that close (each can be turned off), the
// focus back where it was, the shared scroll lock, and the Back button closing the top one.
//
//   <button data-modal-open="about">About</button>
//   <dialog id="about" class="kit-modal" data-size="sm|lg|sheet" data-dismiss="backdrop esc"
//           aria-labelledby="about-title"> … <button data-modal-close>Close</button></dialog>
//
//   SiteKit.modal.open("about", opener?)  SiteKit.modal.close(dialog?, value?)  SiteKit.modal.top()
// Events on the dialog: "kit:open", "kit:close" (detail: the return value).
(function (w, d) {
  "use strict";
  var K = w.SiteKit;
  if (!K) return;
  var stack = [];

  function get(x) { return typeof x === "string" ? d.getElementById(x) : x; }
  function state(dlg) { for (var i = 0; i < stack.length; i++) if (stack[i].dlg === dlg) return stack[i]; return null; }
  function allows(dlg, what) {
    var v = dlg.getAttribute("data-dismiss");
    return (v == null ? "backdrop esc" : v).split(/\s+/).indexOf(what) >= 0;
  }

  function open(dlg, opener) {
    dlg = get(dlg);
    if (!dlg || typeof dlg.showModal !== "function") return false;
    if (dlg.open) return true;
    wire(dlg);
    var st = { dlg: dlg, opener: opener || d.activeElement, back: null, closing: false };
    stack.push(st);
    K.lock();
    dlg.classList.add("kit-modal");
    dlg.removeAttribute("data-state");
    dlg.showModal();
    // Laid out in its closed look first, then moved to the open one: the entry transition.
    void dlg.offsetWidth;
    dlg.setAttribute("data-state", "open");
    if (dlg.getAttribute("data-history") !== "off") st.back = K.backEntry(function () { close(dlg, undefined, true); });
    var first = dlg.querySelector("[autofocus], [data-modal-focus]");
    if (first) K.focus(first);
    dlg.dispatchEvent(new CustomEvent("kit:open"));
    return true;
  }

  function close(dlg, value, fromBack) {
    dlg = get(dlg) || (stack.length ? stack[stack.length - 1].dlg : null);
    var st = dlg && state(dlg);
    if (!st || st.closing) return;
    st.closing = true;
    if (!fromBack && st.back) st.back.release();
    st.back = null;
    dlg.setAttribute("data-state", "closing");
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      dlg.removeEventListener("transitionend", onEnd);
      if (dlg.open) dlg.close(value === undefined ? "" : String(value));
    }
    function onEnd(e) { if (e.target === dlg) finish(); }
    var ms = K.reduced() ? K.ms("--kit-dur-fast", 160) : K.ms("--kit-dur-out", 200);
    if (getComputedStyle(dlg).transitionDuration.split(",").every(function (t) { return parseFloat(t) === 0; })) finish();
    else {
      dlg.addEventListener("transitionend", onEnd);
      setTimeout(finish, ms + 120);
    }
  }

  // Whatever closed it (the kit, a form's method="dialog", the browser on its own): the lock, the
  // history entry and the focus are put back.
  function closed(dlg) {
    var st = state(dlg);
    if (!st) return;
    stack.splice(stack.indexOf(st), 1);
    if (st.back) st.back.release();
    dlg.removeAttribute("data-state");
    K.unlock();
    if (!K.focus(st.opener)) {
      var top = stack.length ? stack[stack.length - 1].dlg : null;
      if (top) K.focus(top);
    }
    dlg.dispatchEvent(new CustomEvent("kit:close", { detail: dlg.returnValue }));
  }

  function wire(dlg) {
    if (dlg._kitModal) return;
    dlg._kitModal = true;
    dlg.addEventListener("cancel", function (e) {
      e.preventDefault();
      if (allows(dlg, "esc")) close(dlg);
    });
    dlg.addEventListener("close", function () { closed(dlg); });
    // A press that starts and ends outside the dialog's box is a click on the backdrop (a drag
    // that began inside, say selecting text, is not).
    var downOut = false;
    function outside(e) {
      var r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    }
    dlg.addEventListener("pointerdown", function (e) { downOut = e.target === dlg && outside(e); });
    dlg.addEventListener("click", function (e) {
      if (downOut && e.target === dlg && outside(e) && allows(dlg, "backdrop")) close(dlg);
      downOut = false;
    });
    // A form's method="dialog" closes with the same exit transition.
    dlg.addEventListener("submit", function (e) {
      var f = e.target;
      if (!f || (f.getAttribute("method") || "").toLowerCase() !== "dialog" || f.closest("dialog") !== dlg) return;
      e.preventDefault();
      close(dlg, e.submitter ? e.submitter.value : "");
    });
  }

  d.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var opener = t.closest("[data-modal-open]");
    if (opener && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (open(opener.getAttribute("data-modal-open"), opener)) e.preventDefault();
      return;
    }
    var closer = t.closest("[data-modal-close]");
    if (closer) {
      var dlg = closer.closest("dialog");
      if (dlg && state(dlg)) { e.preventDefault(); close(dlg, closer.getAttribute("data-modal-close") || closer.value); }
    }
  });

  K.modal = {
    open: open,
    close: close,
    top: function () { return stack.length ? stack[stack.length - 1].dlg : null; }
  };
})(window, document);
