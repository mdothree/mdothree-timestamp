// js/auth-nav.js — MDOThree shared template, adapter for surfaces built on js/config/config.js
// (hash, color, password, timestamp, mdothree.com). Source: shared/mdothree/auth-nav.config.js.
// Feeds the nav cluster (site-chrome.js) with the REAL Firebase auth state and the checkout flag.
//  - Anonymous guests count as signed out.
//  - PRO_CHECKOUT_ENABLED=false (#66b, today): nothing changes. The Pro control stays
//    "Pro (coming soon)" -> mdothree.com/pro and signed-out visitors see no account control.
//  - When it is on, the Pro control opens the upgrade modal and signed-out visitors get a "Sign in"
//    button that opens js/auth-ui.js (the Firebase SDK still loads only then: PERF-002).
//  - A real (non-anonymous) Firebase user gets the account menu with Sign out.
//  - openSignIn() is the one entry point the Pro / account UI uses; auth-ui.js loads only when it is called.
import { onAuthChange, loadFirebase, getFirebaseAuth, IS_CONFIGURED, PRO_CHECKOUT_ENABLED } from './config/config.js';

const chromeReady = () => window.mdoChrome
  ? Promise.resolve(window.mdoChrome)
  : new Promise(res => document.addEventListener('mdo-chrome-ready', () => res(window.mdoChrome), { once: true }));

async function signOutUser() {
  const sdk = await loadFirebase();
  if (sdk) await sdk.auth.signOut(getFirebaseAuth());
}

async function getAuthInstance() {
  const sdk = await loadFirebase();   // PERF-002: the SDK loads here, when the sign-in UI opens
  return sdk ? getFirebaseAuth() : null;
}

/**
 * Open the shared sign-in / create-account / reset dialog. Resolves to the signed-in user, or null.
 * @param {{ mode?: 'signin'|'signup'|'reset', reason?: string }} [opts]
 */
export async function openSignIn(opts = {}) {
  const ui = await import('./auth-ui.js');
  return ui.openAuthDialog({ ...opts, getAuth: getAuthInstance });
}

chromeReady().then(chrome => {
  if (PRO_CHECKOUT_ENABLED) {
    chrome.setCheckout({ enabled: true, onClick: () => import('./services/paywallUI.js').then(m => m.openUpgradeModal()) });
  }
  if (!IS_CONFIGURED || !document.querySelector('meta[name="firebase-config"]')) { chrome.setUser(null); return; }
  const signedOutOpts = PRO_CHECKOUT_ENABLED ? { signIn: () => openSignIn() } : {};
  onAuthChange(u => chrome.setUser(u && !u.isAnonymous ? u : null, { ...signedOutOpts, signOut: signOutUser }));
});
