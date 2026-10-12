// shared/config.js — Single source of truth for all mdothree projects.
// Firebase v10 modular SDK + Stripe configuration.
//
// Config injection priority (first match wins):
//   1. window.__CONFIG  (set by a <script> in index.html, injected by Vercel build)
//   2. <meta name="firebase-config"> + <meta name="stripe-config"> (static fallback)
//   3. Placeholder values (dev only — app shows a setup banner)
//
// HID-001 / PROD-013: Firebase is loaded LAZILY with dynamic import(). It used to be
// imported statically at the top of this module, so if www.gstatic.com was
// unreachable (offline, corporate proxy, content blocker) the whole module graph
// failed and every tool page was dead and silent. Now the tool core never depends
// on Firebase: when the SDK cannot load, auth reports "no user", Pro features stay
// on the free tier, and history falls back to this browser.

const SDK = 'https://www.gstatic.com/firebasejs/10.12.0/';

// ─────────────────────────────────────────────────────────────
// 1. Load configuration
// ─────────────────────────────────────────────────────────────

function readMeta(name) {
  try {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? JSON.parse(el.content) : null;
  } catch { return null; }
}

function loadConfig() {
  if (typeof window === 'undefined') return {};
  if (window.__CONFIG) return window.__CONFIG;

  const fb  = readMeta('firebase-config') || {};
  const str = readMeta('stripe-config')   || {};
  return { ...fb, ...str };
}

const CONFIG = loadConfig();

/** True when placeholder values are still in place */
export const IS_CONFIGURED = !String(CONFIG.apiKey || '').startsWith('REPLACE');

if (!IS_CONFIGURED && typeof document !== 'undefined') {
  // Show a one-time setup warning in the page title bar
  console.warn(
    '[mdothree] Firebase/Stripe config not set. ' +
    'Replace meta tag values or set window.__CONFIG before deploying.'
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Firebase — lazy, optional singleton
// ─────────────────────────────────────────────────────────────

let _sdk = null;          // { app, fs, auth } modules once loaded
let _sdkPromise = null;
let _app, _db, _auth;

/**
 * Load the Firebase SDK on demand. Resolves to the module set, or null when the
 * SDK is unreachable / init fails (never rejects).
 */
export function loadFirebase() {
  if (!_sdkPromise) {
    _sdkPromise = Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
      import(SDK + 'firebase-auth.js'),
    ]).then(([app, fs, auth]) => {
      _sdk = { app, fs, auth };
      getFirebaseApp();
      return _sdk;
    }).catch(e => {
      _sdk = null;
      console.warn('[mdothree] Firebase unavailable; running without account features:', e?.message);
      return null;
    });
  }
  return _sdkPromise;
}

/** True once the SDK has loaded successfully. */
export function isFirebaseReady() { return !!_sdk; }

export function getFirebaseApp() {
  if (_app) return _app;
  if (!_sdk) return null;
  const cfg = {
    apiKey:            CONFIG.apiKey            || '',
    authDomain:        CONFIG.authDomain        || '',
    projectId:         CONFIG.projectId         || '',
    storageBucket:     CONFIG.storageBucket     || '',
    messagingSenderId: CONFIG.messagingSenderId || '',
    appId:             CONFIG.appId             || '',
  };
  const { getApps, initializeApp } = _sdk.app;
  _app = getApps().length ? getApps()[0] : initializeApp(cfg);
  initAppCheck(_app);
  return _app;
}

// App Check (OFF by default). Enable with window.__CONFIG / firebase-config meta:
//   { ..., "appCheckEnabled": true, "appCheckSiteKey": "<reCAPTCHA Enterprise site key>" }
// Register the key in Firebase console > App Check (mdo3d-utilities) and keep
// enforcement OFF until the console shows verified traffic. Loaded lazily so pages
// that never enable it don't download the module.
let _appCheckStarted = false;
function initAppCheck(app) {
  if (_appCheckStarted) return;
  _appCheckStarted = true;
  const on = CONFIG.appCheckEnabled === true || CONFIG.appCheckEnabled === 'true';
  if (!on || !CONFIG.appCheckSiteKey) return;
  import(SDK + 'firebase-app-check.js')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(CONFIG.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    }))
    .catch(e => console.warn('[mdothree] App Check init failed:', e?.message));
}

/** Firestore instance, or null while/if the SDK is not loaded. */
export function getDB() {
  if (_db) return _db;
  if (!_sdk) return null;
  _db = _sdk.fs.getFirestore(getFirebaseApp());
  return _db;
}

// Stand-in returned before/without the SDK so `getFirebaseAuth().currentUser`
// stays safe for synchronous callers (it simply reports "no user").
const NO_AUTH = Object.freeze({ currentUser: null });

export function getFirebaseAuth() {
  if (_auth) return _auth;
  if (!_sdk) return NO_AUTH;
  _auth = _sdk.auth.getAuth(getFirebaseApp());
  return _auth;
}

// ─────────────────────────────────────────────────────────────
// 3. Auth helpers
// ─────────────────────────────────────────────────────────────

export async function ensureAnonymousUser() {
  const sdk = await loadFirebase();
  if (!sdk) return null;
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) return auth.currentUser;
    const cred = await sdk.auth.signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    console.warn('[mdothree] Anonymous sign-in failed:', e?.code || e?.message);
    return null;
  }
}

/**
 * Subscribe to auth changes. Returns an unsubscribe function synchronously.
 * If Firebase cannot load, the callback fires once with null (signed out).
 */
export function onAuthChange(cb) {
  let cancelled = false;
  let unsub = null;
  loadFirebase().then(sdk => {
    if (cancelled) return;
    if (!sdk) { cb(null); return; }
    try {
      const u = sdk.auth.onAuthStateChanged(getFirebaseAuth(), cb);
      if (cancelled) u(); else unsub = u;
    } catch (e) {
      console.warn('[mdothree] auth listener failed:', e?.message);
      cb(null);
    }
  });
  return () => { cancelled = true; if (unsub) unsub(); };
}

// ─────────────────────────────────────────────────────────────
// 4. Stripe config
// ─────────────────────────────────────────────────────────────

export const STRIPE_CONFIG = {
  publishableKey: CONFIG.publishableKey || CONFIG.STRIPE_PUBLISHABLE_KEY || '',
  priceIdMonthly: CONFIG.priceIdMonthly || CONFIG.STRIPE_PRICE_ID_MONTHLY || '',
  priceIdYearly:  CONFIG.priceIdYearly  || CONFIG.STRIPE_PRICE_ID_YEARLY  || '',
  portalUrl:      CONFIG.portalUrl      || CONFIG.STRIPE_CUSTOMER_PORTAL_URL || '#',
};

export const IS_TEST_MODE = STRIPE_CONFIG.publishableKey.startsWith('pk_test_');

// #66b: Pro is not on sale until the operator turns this on (Vercel env
// PRO_CHECKOUT_ENABLED=true -> stripe-config meta). Off: the upgrade modal says
// "coming soon", shows no price and opens no Stripe checkout / payment link.
export const PRO_CHECKOUT_ENABLED = CONFIG.PRO_CHECKOUT_ENABLED === true || CONFIG.PRO_CHECKOUT_ENABLED === 'true';

// ─────────────────────────────────────────────────────────────
// 5. Firestore helpers so callers import from one place.
//    Thin delegates to the lazily loaded module; they throw (inside the
//    caller's try/catch) if used before Firebase is available.
// ─────────────────────────────────────────────────────────────

function fs(name) {
  return (...args) => {
    if (!_sdk) throw new Error('Firebase unavailable');
    return _sdk.fs[name](...args);
  };
}

export const serverTimestamp = fs('serverTimestamp');
export const collection      = fs('collection');
export const addDoc          = fs('addDoc');
export const getDocs         = fs('getDocs');
export const query           = fs('query');
export const where           = fs('where');
export const orderBy         = fs('orderBy');
export const limit           = fs('limit');
export const deleteDoc       = fs('deleteDoc');
export const doc             = fs('doc');
export const setDoc          = fs('setDoc');
export const getDoc          = fs('getDoc');
export const updateDoc       = fs('updateDoc');

// ─────────────────────────────────────────────────────────────
// 6. Pro plan + feature metadata
//    Re-exported from stripe.js so callers that import from the
//    single config entry point (e.g. services/paywallUI.js) can
//    reach PLANS and proFeatureLabel without a second import path.
// ─────────────────────────────────────────────────────────────

export { PLANS, proFeatureLabel, PRO_FEATURES, requiresPro } from './stripe.js';
