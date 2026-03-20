// shared/config.js — Single source of truth for all mdothree projects.
// Firebase v10 modular SDK + Stripe configuration.
//
// Config injection priority (first match wins):
//   1. window.__CONFIG  (set by a <script> in index.html, injected by Vercel build)
//   2. <meta name="firebase-config"> + <meta name="stripe-config"> (static fallback)
//   3. Placeholder values (dev only — app shows a setup banner)

import { initializeApp, getApps }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit,
         serverTimestamp, deleteDoc, doc, setDoc, getDoc, updateDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInAnonymously }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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
// 2. Firebase — singleton init
// ─────────────────────────────────────────────────────────────

let _app, _db, _auth;

export function getFirebaseApp() {
  if (_app) return _app;
  const cfg = {
    apiKey:            CONFIG.apiKey            || '',
    authDomain:        CONFIG.authDomain        || '',
    projectId:         CONFIG.projectId         || '',
    storageBucket:     CONFIG.storageBucket     || '',
    messagingSenderId: CONFIG.messagingSenderId || '',
    appId:             CONFIG.appId             || '',
  };
  _app = getApps().length ? getApps()[0] : initializeApp(cfg);
  return _app;
}

export function getDB() {
  if (_db) return _db;
  _db = getFirestore(getFirebaseApp());
  return _db;
}

export function getFirebaseAuth() {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  return _auth;
}

// ─────────────────────────────────────────────────────────────
// 3. Auth helpers
// ─────────────────────────────────────────────────────────────

export async function ensureAnonymousUser() {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    console.warn('[mdothree] Anonymous sign-in failed:', e.code);
    return null;
  }
}

export function onAuthChange(cb) {
  return onAuthStateChanged(getFirebaseAuth(), cb);
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

// ─────────────────────────────────────────────────────────────
// 5. Re-export Firestore helpers so callers import from one place
// ─────────────────────────────────────────────────────────────

export {
  serverTimestamp, collection, addDoc, getDocs, query,
  where, orderBy, limit, deleteDoc, doc, setDoc, getDoc, updateDoc,
};
