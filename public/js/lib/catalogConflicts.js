// Enforces field-catalog `conflictsWith`: two boolean settings that must
// never both be on (auto-pause/auto-stop, Aikar's/MeowIce's JVM flags, …).
// The catalog's `note` badge documents the conflict, but a badge alone
// doesn't stop anyone from checking both - this auto-unchecks the other
// side and says why, in both the wizard's advanced mode and the
// post-creation Settings tab (same catalog-field markup, same behavior).
export function wireCatalogConflicts(root, { toast, reconcileSilently = false } = {}) {
  function resolve(el, { announce }) {
    if (!el.checked) return;
    const other = root.querySelector(`[data-catalog-key="${el.dataset.catalogConflicts}"]`);
    if (!other || !other.checked) return;
    other.checked = false;
    other.dispatchEvent(new Event('change', { bubbles: true }));
    if (announce) {
      const otherLabel = other.dataset.label || other.dataset.catalogKey;
      const thisLabel = el.dataset.label || el.dataset.catalogKey;
      toast?.(`Turned off "${otherLabel}" - it can't be on at the same time as "${thisLabel}".`);
    }
  }

  const conflicting = root.querySelectorAll('[data-catalog-conflicts]');
  // A server saved (e.g. via the raw KEY=value escape hatch) before this
  // conflict was enforced could already have both sides on - reconcile that
  // once on load, quietly, rather than just leaving it silently wrong until
  // someone happens to touch one of the two checkboxes.
  conflicting.forEach((el) => resolve(el, { announce: !reconcileSilently }));

  conflicting.forEach((el) => {
    el.addEventListener('change', () => resolve(el, { announce: true }));
  });
}
