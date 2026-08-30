// One friendly fallback for failed API calls. Call sites still prefer a
// server-supplied `data.error` message; this fills in when there isn't one, so
// a user never sees a bare status code or a raw exception string.
//
// Usage:
//   toast(data.error || friendlyError(res, { action: 'save your settings' }));
//   throw new Error(data.error || friendlyError(res, { action: 'load the list' }));
//   } catch (err) { toast(friendlyError(err, { action: 'save your settings' })); }

const REASONS = {
  400: 'the panel could not accept that request',
  401: 'your session has expired, so sign in again',
  403: 'you do not have permission to do that',
  404: 'the panel could not find what that action needed',
  409: 'something changed since the page loaded, so reload and try again',
  413: 'that file is too large',
  429: 'the panel is being rate-limited, so wait a moment',
  503: 'Docker or the server looks unavailable right now',
};

// Accepts a fetch Response, a plain status number, or a thrown Error.
export function friendlyError(source, { action } = {}) {
  const lead = action ? `Couldn't ${action}` : 'Something went wrong';
  const status = typeof source === 'number' ? source : source && source.status;
  if (status) {
    const reason = REASONS[status] || (status >= 500 ? 'the panel hit an error' : 'the request did not go through');
    return `${lead}: ${reason}. Please try again in a moment.`;
  }
  return `${lead}: the panel is unreachable. Check your connection and try again.`;
}
