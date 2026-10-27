// One friendly fallback for failed API calls. Call sites still prefer a
// server-supplied `data.error` message; this fills in when there isn't one, so
// a user never sees a bare status code or a raw exception string.
//
// Usage:
//   toast(data.error || friendlyError(res, { action: 'save your settings' }));
//   throw new Error(data.error || friendlyError(res, { action: 'load the list' }));
//   } catch (err) { toast(friendlyError(err, { action: 'save your settings' })); }

import { t } from './i18n.js';

const REASONS = {
  400: 'errors.reasons.400',
  401: 'errors.reasons.401',
  403: 'errors.reasons.403',
  404: 'errors.reasons.404',
  409: 'errors.reasons.409',
  413: 'errors.reasons.413',
  429: 'errors.reasons.429',
  503: 'errors.reasons.503',
};

// Accepts a fetch Response, a plain status number, or a thrown Error.
export function friendlyError(source, { action, actionKey } = {}) {
  let resolvedAction = null;
  if (actionKey) {
    resolvedAction = t(actionKey);
  } else if (action) {
    const actionKeyCandidate = `errors.actions.${String(action)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')}`;
    const translated = t(actionKeyCandidate);
    if (translated !== actionKeyCandidate) {
      resolvedAction = translated;
    } else {
      const msm = (typeof window !== 'undefined' && window.MSM) || {};
      const locale = msm.locale || 'en';
      if (locale === 'en') {
        resolvedAction = action;
      }
    }
  }

  const lead = resolvedAction ? t('errors.action_lead', { action: resolvedAction }) : t('errors.generic_lead');
  const status = typeof source === 'number' ? source : source && source.status;
  if (status) {
    const key = REASONS[status] || (status >= 500 ? 'errors.reasons.500' : 'errors.reasons.default');
    const reason = t(key);
    const suffix = t('errors.try_again');
    return `${lead}: ${reason}. ${suffix}`;
  }
  return `${lead}: ${t('errors.unreachable')}`;
}
