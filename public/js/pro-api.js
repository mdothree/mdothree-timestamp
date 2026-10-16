// js/pro-api.js — client for the mdothree-api paid / account endpoints
// (mdothree/mdothree-api feat/mdothree-pro-2026-10-16; shared by every mdothree tool).
//
// mdothree Pro is ONE lifetime purchase (DECISIONS 2026-10-16): $29 once, no subscription.
// The only way to buy is Stripe-hosted Checkout (createCheckoutSession); the Stripe webhook
// writes subscriptions/{uid} and is the only thing that grants Pro (hasProEntitlement below).
//
// Contract with the hardened API:
//   - Every call sends `Authorization: Bearer <Firebase ID token>` of a signed-in,
//     NON-anonymous user. Guests are refused here, before any request is made.
//   - No uid is ever sent in the body: the server acts only on the token's uid.
//   - Errors are { success:false, error, code } with 400/401/402/403/404/409/429/5xx.
//     They are mapped to plain, honest messages below (never the raw server text).
// Endpoints used: createCheckoutSession, createBillingPortalSession (receipts).
// No Firebase import: callers pass their own `auth`, so the SDK stays lazy (PERF-002).

const CONTACT = 'hello@mdothree.com';

const MESSAGES = {
  sign_in_required:        'Sign in to your mdothree account to continue. Pro belongs to a signed-in account, not a guest session.',
  unauthorized:            'Sign in to your mdothree account to continue.',
  invalid_token:           'Your sign-in could not be verified. Sign out, sign in again and retry.',
  token_expired:           'Your session expired. Sign in again and retry.',
  token_unavailable:       'Your sign-in could not be verified. Sign out, sign in again and retry.',
  anonymous_not_allowed:   'Pro needs a signed-in mdothree account, not a guest session. Sign in to continue.',
  uid_mismatch:            'This request did not match the signed-in account. Reload the page and try again.',
  forbidden:               'This account cannot do that.',
  subscription_required:   'This feature is part of mdothree Pro.',
  payment_failed:          'Your card was declined. Nothing was charged. Try another card.',
  checkout_disabled:       "Pro checkout isn't open yet. Nothing was charged.",
  checkout_not_configured: `Checkout isn't available right now. Nothing was charged. Try again later or contact ${CONTACT}.`,
  price_misconfigured:     `Checkout isn't available right now. Nothing was charged. Try again later or contact ${CONTACT}.`,
  billing_not_configured:  `Billing isn't available right now. Try again later or contact ${CONTACT}.`,
  unavailable:             'The Pro service is unavailable right now. Try again in a few minutes.',
  upstream_unavailable:    'The payment provider did not respond. Try again in a few minutes.',
  already_subscribed:      'This account already has mdothree Pro. It never expires, so there is nothing more to buy.',
  no_subscription:         'No mdothree Pro purchase was found for this account.',
  unknown_plan:            'Reload the page and try again.',
  use_checkout:            'Reload the page: Pro is now bought on Stripe\'s secure checkout page.',
  bad_request:             'Something was missing from the request. Reload the page and try again.',
  rate_limited:            'Too many attempts. Wait a minute and try again.',
  network:                 "Couldn't reach mdothree. Check your connection and try again.",
  bad_response:            `Unexpected reply from mdothree. Try again, or contact ${CONTACT}.`,
  internal:                `Something went wrong on our side. Try again, or contact ${CONTACT}.`,
  not_found:               `Billing isn't available right now. Try again later or contact ${CONTACT}.`,
};

const STATUS_CODES = {
  400: 'bad_request', 401: 'unauthorized', 402: 'subscription_required', 403: 'forbidden',
  404: 'no_subscription', 409: 'already_subscribed', 410: 'use_checkout', 429: 'rate_limited', 503: 'unavailable',
};

export class ProApiError extends Error {
  constructor(status, code, message) {
    super(message || proErrorMessage(status, code));
    this.name = 'ProApiError';
    this.status = status;
    this.code = code;
  }
  /** True when the fix is to sign in (show a sign-in prompt, not a retry). */
  get needsSignIn() {
    return ['sign_in_required', 'unauthorized', 'invalid_token', 'token_expired',
      'token_unavailable', 'anonymous_not_allowed'].includes(this.code);
  }
}

/** Honest user-facing text for an API status + code. */
export function proErrorMessage(status, code) {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (STATUS_CODES[status]) return MESSAGES[STATUS_CODES[status]];
  return MESSAGES.internal;
}

/** The signed-in, non-anonymous Firebase user, or null (guests never count). */
export function signedInUser(auth) {
  const u = auth && auth.currentUser;
  return u && !u.isAnonymous && typeof u.getIdToken === 'function' ? u : null;
}

/**
 * POST <baseUrl>/<name> as the signed-in user.
 * @param {string} name  createCheckoutSession | createBillingPortalSession
 * @param {object} body  request body; any `uid` is dropped (the token decides the account)
 * @param {{ baseUrl: string, auth: object, fetchImpl?: Function }} opts
 * @returns {Promise<object>} the success JSON
 * @throws {ProApiError}
 */
export async function callProApi(name, body = {}, { baseUrl, auth, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!baseUrl || !doFetch) throw new ProApiError(503, 'checkout_not_configured');
  const user = signedInUser(auth);
  if (!user) throw new ProApiError(401, 'sign_in_required');

  const { uid: _dropped, ...clean } = (body && typeof body === 'object') ? body : {};
  const url = `${String(baseUrl).replace(/\/+$/, '')}/${name}`;

  const attempt = async (forceRefresh) => {
    let token;
    try { token = await user.getIdToken(forceRefresh); } catch { throw new ProApiError(401, 'token_unavailable'); }
    if (!token) throw new ProApiError(401, 'token_unavailable');
    let res;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(clean),
      });
    } catch {
      throw new ProApiError(0, 'network');
    }
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON (e.g. a proxy error page) */ }
    if (!res.ok || !data || data.success === false) {
      const code = (data && typeof data.code === 'string' && data.code) || (res.ok ? 'bad_response' : STATUS_CODES[res.status] || 'internal');
      throw new ProApiError(res.status, code);
    }
    return data;
  };

  try {
    return await attempt(false);
  } catch (e) {
    // A cached token can expire between getIdToken() and the server check: refresh once.
    if (e instanceof ProApiError && e.code === 'token_expired') return attempt(true);
    throw e;
  }
}

/** Only ever send the browser to Stripe-hosted pages (https, *.stripe.com). */
export function isStripeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'));
  } catch { return false; }
}

/** The one Pro product: a one-time lifetime purchase. Display only; the server fixes the real price. */
export const PRO_OFFER = Object.freeze({ plan: 'lifetime', price: '$29', label: 'mdothree Pro, lifetime', note: 'One payment. No subscription. Pro never expires.' });

const PLAN_NAMES = new Set(['lifetime']);

/**
 * The real entitlement check, shared by every surface. subscriptions/{uid} is written only by the
 * Stripe webhook (Admin SDK; firestore.rules deny client writes): a paid lifetime purchase sets
 * { isPro:true, plan:'pro', status:'lifetime', lifetime:true }; a refund or dispute clears it.
 */
export function hasProEntitlement(d) {
  return !!d && d.isPro === true && d.plan === 'pro' && d.status === 'lifetime' && d.lifetime === true;
}

/** createCheckoutSession -> the Stripe-hosted Checkout URL (server fixes price and success/cancel URLs). */
export async function createCheckout(plan = 'lifetime', opts) {
  if (!PLAN_NAMES.has(plan)) throw new ProApiError(400, 'unknown_plan');
  const data = await callProApi('createCheckoutSession', { plan }, opts);
  if (!isStripeUrl(data.url)) throw new ProApiError(200, 'bad_response');
  return data.url;
}

/** createBillingPortalSession -> the Stripe Customer Portal URL (receipts) for the signed-in account. */
export async function createPortal(returnUrl, opts) {
  const data = await callProApi('createBillingPortalSession', returnUrl ? { returnUrl } : {}, opts);
  if (!isStripeUrl(data.url)) throw new ProApiError(200, 'bad_response');
  return data.url;
}
