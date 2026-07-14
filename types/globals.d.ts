// Ambient type augmentations for JS patterns that `tsc --checkJs` can't infer
// on its own. These describe real shapes the code relies on — not suppressions.
//
// No import/export in this file, so it stays a global script and the interface
// below merges into the global `Error` type.

// The panel attaches an HTTP status (and sometimes a code) to Error objects
// throughout: see src/utils/httpError.js and the `Object.assign(new Error(), {
// status })` / `err.status = 4xx` pattern used by services and route guards.
interface Error {
  status?: number;
  code?: string;
}
