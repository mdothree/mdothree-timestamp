// js/auth-nav.js — MDOThree shared template, adapter for surfaces built on js/config/config.js
// (hash, color, password, timestamp, mdothree.com). Source: shared/mdothree/auth-nav.config.js.
// Feeds the nav cluster (site-chrome.js) with the REAL Firebase auth state and the checkout flag.
//  - Anonymous guests count as signed out. These surfaces have no sign-in flow yet, so signed-out
//    visitors see no account control at all (never a "Sign in" button that leads nowhere).
//  - A real (non-anonymous) Firebase user gets the account menu with Sign out.
//  - PRO_CHECKOUT_ENABLED=false (#66b): the Pro control stays "Pro (coming soon)" -> mdothree.com/pro.
import { onAuthChange, loadFirebase, getFirebaseAuth, IS_CONFIGURED, PRO_CHECKOUT_ENABLED } from './config/config.js';

const chromeReady = () => window.mdoChrome
  ? Promise.resolve(window.mdoChrome)
  : new Promise(res => document.addEventListener('mdo-chrome-ready', () => res(window.mdoChrome), { once: true }));

async function signOutUser() {
  const sdk = await loadFirebase();
  if (sdk) await sdk.auth.signOut(getFirebaseAuth());
}

chromeReady().then(chrome => {
  if (PRO_CHECKOUT_ENABLED) {
    chrome.setCheckout({ enabled: true, onClick: () => import('./services/paywallUI.js').then(m => m.openUpgradeModal()) });
  }
  if (!IS_CONFIGURED || !document.querySelector('meta[name="firebase-config"]')) { chrome.setUser(null); return; }
  onAuthChange(u => chrome.setUser(u && !u.isAnonymous ? u : null, { signOut: signOutUser }));
});
