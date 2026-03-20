// services/subscriptionService.js
// Checks whether the current Firebase user has an active Pro subscription.
// The source of truth is a Firestore doc written by the Stripe webhook Cloud Function.
// Falls back gracefully (free tier) if Firebase or Firestore is unavailable.

import { getFirebaseAuth, getDB, onAuthChange } from '../config/config.js';

const SUBSCRIPTIONS_COL = 'subscriptions';

// ---- In-memory cache ----
let _cachedStatus = null;   // null | { isPro, plan, periodEnd, stripeCustomerId }
let _listeners    = [];

// ---- Internal fetch ----
async function fetchSubscriptionStatus(uid) {
  if (!uid) return { isPro: false, plan: 'free' };
  try {
    // Dynamic import to avoid hard crash if firebase isn't loaded yet
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const db   = getDB();
    const ref  = doc(db, SUBSCRIPTIONS_COL, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { isPro: false, plan: 'free' };

    const data = snap.data();
    const now  = Date.now();
    const periodEnd = data.currentPeriodEnd?.toMillis?.() ?? 0;
    const active    = data.status === 'active' && periodEnd > now;

    return {
      isPro:             active,
      plan:              active ? 'pro' : 'free',
      status:            data.status,
      periodEnd:         new Date(periodEnd),
      stripeCustomerId:  data.stripeCustomerId ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    };
  } catch (e) {
    console.warn('[subscriptionService] fetch failed:', e.message);
    return { isPro: false, plan: 'free' };
  }
}

// ---- Public API ----

/**
 * Initialise subscription watcher. Call once per page.
 * Re-checks whenever auth state changes.
 */
export function initSubscription() {
  onAuthChange(async user => {
    _cachedStatus = null; // clear cache on auth change
    if (user) {
      _cachedStatus = await fetchSubscriptionStatus(user.uid);
    } else {
      _cachedStatus = { isPro: false, plan: 'free' };
    }
    _listeners.forEach(cb => cb(_cachedStatus));
  });
}

/**
 * Register a listener called whenever subscription status changes.
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
 * Returns false if not yet loaded (safe default = free tier).
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
      const status = await fetchSubscriptionStatus(user.uid);
      _cachedStatus = status;
      resolve(status.isPro);
    });
  });
}

/**
 * Get full subscription details.
 */
export function getSubscriptionStatus() {
  return _cachedStatus ?? { isPro: false, plan: 'free' };
}

/**
 * Force a fresh fetch (e.g. after successful payment redirect).
 */
export async function refreshSubscription() {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  _cachedStatus = await fetchSubscriptionStatus(user.uid);
  _listeners.forEach(cb => cb(_cachedStatus));
  return _cachedStatus;
}
