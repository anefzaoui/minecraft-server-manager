// What a Settings save may send: only what the person changed on the page
// (#113). The page reads every control once, as the server rendered it, and
// again at Save; a control that reads the same both times is left out. So a
// value the person never set can't be written: a slider clamped to its range,
// a select showing its default, or a value the browser put back into the wrong
// field when the page reloaded. Pure functions with no DOM and no imports, so
// test/settings-changes.test.js runs this same file in Node.

/**
 * The value an advanced (field-catalog) control shows for the server's env,
 * the same rule the page fills them by: a boolean shows the env value or its
 * catalog default, an enum with a default shows that default, anything else
 * shows the env value or stays empty.
 * @param {{ type: string, default?: string }} field
 * @param {Record<string, string>} env
 * @param {string} key
 * @returns {string}
 */
export function renderedValue(field, env, key) {
  const has = Object.prototype.hasOwnProperty.call(env, key);
  if (field.type === 'boolean') {
    if (has) return env[key] === 'true' ? 'true' : 'false';
    return field.default === 'true' ? 'true' : 'false';
  }
  if (has) return String(env[key]);
  return field.type === 'enum' && field.default ? String(field.default) : '';
}

/**
 * The env to save: the server's env with each changed field applied over it.
 * A field that reads as it did when the page loaded is left alone, whatever
 * its value. An emptied field removes its key, so the server goes back to the
 * default (the panel then takes that key out of server.properties too).
 * @param {Record<string, string>} env the server's env, as the page got it
 * @param {Record<string, { type: string, value: string }>} before each field when the page loaded
 * @param {Record<string, { type: string, value: string }>} after each field at Save
 * @returns {{ env: Record<string, string>, changed: string[] }}
 */
export function mergeEnvChanges(env, before, after) {
  const merged = { ...env };
  const changed = [];
  for (const [key, now] of Object.entries(after)) {
    const was = before[key];
    if (was && was.value === now.value) continue;
    if (now.type === 'boolean' || now.value !== '') {
      if (merged[key] === now.value) continue;
      merged[key] = now.value;
    } else {
      if (!Object.prototype.hasOwnProperty.call(merged, key)) continue;
      delete merged[key];
    }
    changed.push(key);
  }
  return { env: merged, changed };
}

/**
 * The names whose value differs between two readings of the page's own
 * fields (name, heap, CPU, …), compared as the strings the controls hold.
 * @param {Record<string, string>} before
 * @param {Record<string, string>} after
 * @returns {string[]}
 */
export function changedKeys(before, after) {
  return Object.keys(after).filter((key) => after[key] !== before[key]);
}

/**
 * A slider's range widened to hold the value it was rendered with, so a
 * setting above (or below) the slider's usual range shows as it is instead of
 * being clamped to the end of it.
 * @param {{ min: number, max: number }} range
 * @param {number} value
 * @returns {{ min: number, max: number }}
 */
export function fitRange({ min, max }, value) {
  if (!Number.isFinite(value)) return { min, max };
  return { min: Math.min(min, value), max: Math.max(max, value) };
}
