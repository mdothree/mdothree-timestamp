// services/subscriptionService.js
// Checks whether the current Firebase user owns mdothree Pro.
// mdothree Pro is ONE lifetime purchase (DECISIONS 2026-10-16): $29 once, no subscription, never expires.
// The source of truth is subscriptions/{uid}, written only by the Stripe webhook (Admin SDK; rules deny
// client writes). The entitlement check is the shared hasProEntitlement() from pro-api.js.
// Falls back gracefully (no Pro) if Firebase or Firestore is unavailable.

import { getFirebaseAuth, getDB, onAuthChange, doc, getDoc } from '../config/config.js';
import { hasProEntitlement } from '../pro-api.js';

const SUBSCRIPTIONS_COL = 'subscriptions';
const NO_PRO = Object.freeze({ isPro: false, plan: 'none' });

// ---- In-memory cache ----
let _cachedStatus = null;   // null | { isPro, plan, status, lifetime, stripeCustomerId }
let _listeners    = [];

// ---- Internal fetch ----
async function fetchSubscriptionStatus(user) {
  const uid = user?.uid;
  if (!uid) return { ...NO_PRO };
  // Guest (anonymous) sessions are never Pro: their uid is per browser and per
  // subdomain, and the API refuses to sell Pro to one (createCheckoutSession).
  if (user.isAnonymous) return { ...NO_PRO, reason: 'guest' };
  try {
    // Firebase is lazy/optional (HID-001): no SDK -> no Pro, never a crash.
    const db   = getDB();
    if (!db) return { ...NO_PRO, reason: 'offline' };
    const ref  = doc(db, SUBSCRIPTIONS_COL, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ...NO_PRO };

    const data = snap.data();
    // Lifetime Pro: { isPro:true, plan:'pro', status:'lifetime', lifetime:true }.
    // A refund or dispute clears it (webhook), so there is no date to check.
    const pro = hasProEntitlement(data);

    return {
      isPro:            pro,
      plan:             pro ? 'pro' : 'none',
      status:           data.status ?? null,
      lifetime:         pro,
      stripeCustomerId: data.stripeCustomerId ?? null,
    };
  } catch (e) {
    console.warn('[subscriptionService] fetch failed:', e.message);
    return { ...NO_PRO };
  }
}

// ---- Public API ----

/**
 * Initialise the Pro status watcher. Call once per page.
 * Re-checks whenever auth state changes.
 */
export function initSubscription() {
  onAuthChange(async user => {
    _cachedStatus = null; // clear cache on auth change
    if (user) {
      _cachedStatus = await fetchSubscriptionStatus(user);
    } else {
      _cachedStatus = { ...NO_PRO };
    }
    _listeners.forEach(cb => cb(_cachedStatus));
  });
}

/**
 * Register a listener called whenever Pro status changes.
 * @param {Function} cb - called with status object
 * @returns {Function} unsubscribe
 */
export function onSubscriptionChange(cb) {
  _listeners.push(cb);
  if (_cachedStatus) cb(_cachedStatus); // fire immediately if already loaded
  return () => { _listeners = _listeners.filter(l => l !== cb); };
}

/**
 * Synchronously check Pro status from cache.
 * Returns false if not yet loaded (safe default = no Pro).
 */
export function isPro() {
  return _cachedStatus?.isPro === true;
}

/**
 * Async version — waits up to 3s for auth + Firestore to resolve.
 * @returns {Promise<boolean>}
 */
export async function isProAsync() {
  if (_cachedStatus !== null) return _cachedStatus.isPro;
  // Wait for auth to load
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 3000);
    const unsub = onAuthChange(async user => {
      clearTimeout(timeout);
      unsub();
      if (!user) { resolve(false); return; }
      const status = await fetchSubscriptionStatus(user);
      _cachedStatus = status;
      resolve(status.isPro);
    });
  });
}

/**
 * Get full Pro status details.
 */
export function getSubscriptionStatus() {
  return _cachedStatus ?? { ...NO_PRO };
}

/**
 * Force a fresh fetch (e.g. after returning from Stripe Checkout).
 */
export async function refreshSubscription() {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  _cachedStatus = await fetchSubscriptionStatus(user);
  _listeners.forEach(cb => cb(_cachedStatus));
  return _cachedStatus;
}
