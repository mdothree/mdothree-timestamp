// js/auth-ui.js — MDOThree shared template (source: shared/mdothree/auth-ui.js; identical in all 10 surfaces,
// checked by shared/mdothree/tests/parity.test.mjs and each tool repo's tests/shared-parity.test.mjs).
//
// Email/password sign-in, account creation and password reset for an mdothree account, plus Google sign-in
// when it is switched on. Pro (mdothree-api, js/pro-api.js) only serves a signed-in, NON-anonymous account.
//
//  - Loaded on demand: nothing imports this file at page load. The surface adapter (js/auth-nav.js
//    `openSignIn`) imports it when the visitor opens the Pro / account UI, and the Firebase Auth SDK is
//    imported here only then (PERF-002).
//  - A guest (anonymous) session is LINKED to the new account (linkWithCredential), so the uid, and
//    everything saved under it, carries over. Signing in to an existing account cannot merge a guest's data.
//  - Google sign-in is off unless the page config turns it on (GOOGLE_SIGN_IN=true) AND the Google provider
//    is enabled on the Firebase project. The code path is ready either way.
//  - No innerHTML with user or server text; every message is fixed copy below.

export const SDK_AUTH_URL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
const CONTACT = 'hello@mdothree.com';
export const MIN_PASSWORD = 8;

export const AUTH_MESSAGES = {
  'auth/invalid-email':            'Enter a valid email address.',
  'auth/missing-email':            'Enter your email address.',
  'auth/missing-password':         'Enter your password.',
  'auth/weak-password':            `Use a password of at least ${MIN_PASSWORD} characters.`,
  'auth/email-already-in-use':     'An account with this email already exists. Sign in instead.',
  'auth/credential-already-in-use':'An account with this email already exists. Sign in instead.',
  'auth/account-exists-with-different-credential': 'An account with this email already exists. Sign in with your email and password.',
  'auth/provider-already-linked':  'This browser is already signed in to an account. Reload the page.',
  'auth/invalid-credential':       'Email or password is incorrect.',
  'auth/invalid-login-credentials':'Email or password is incorrect.',
  'auth/wrong-password':           'Email or password is incorrect.',
  'auth/user-not-found':           'Email or password is incorrect.',
  'auth/user-disabled':            `This account is disabled. Contact ${CONTACT}.`,
  'auth/too-many-requests':        'Too many attempts. Wait a few minutes and try again, or reset your password.',
  'auth/network-request-failed':   "Couldn't reach the sign-in service. Check your connection and try again.",
  'auth/operation-not-allowed':    `Sign-in isn't available yet. Nothing was changed. Try again later or contact ${CONTACT}.`,
  'auth/admin-restricted-operation': `Sign-in isn't available yet. Nothing was changed. Try again later or contact ${CONTACT}.`,
  'auth/unauthorized-domain':      `Sign-in isn't set up for this web address. Use the mdothree.com site, or contact ${CONTACT}.`,
  'auth/popup-blocked':            'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user':     'The Google sign-in window was closed before it finished.',
  'auth/cancelled-popup-request':  'The Google sign-in window was closed before it finished.',
  'mdo/sdk-unavailable':           "Couldn't load sign-in. Check your connection or content blocker, then try again.",
  'mdo/password-mismatch':         "The two passwords don't match.",
  'mdo/unknown':                   `Sign-in didn't work. Try again, or contact ${CONTACT}.`,
};

export class AuthUiError extends Error {
  constructor(code) {
    super(AUTH_MESSAGES[code] || AUTH_MESSAGES['mdo/unknown']);
    this.name = 'AuthUiError';
    this.code = AUTH_MESSAGES[code] ? code : 'mdo/unknown';
  }
}

/** Honest user-facing text for any Firebase Auth error (never the raw SDK text). */
export function authErrorMessage(err) {
  const code = err && typeof err.code === 'string' ? err.code : '';
  return AUTH_MESSAGES[code] || AUTH_MESSAGES['mdo/unknown'];
}

function toUiError(err) {
  if (err instanceof AuthUiError) return err;
  return new AuthUiError(err && typeof err.code === 'string' ? err.code : 'mdo/unknown');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks before any network call. Returns an error code or ''. */
export function validateCredentials(email, password, { creating = false, confirm } = {}) {
  const e = String(email || '').trim();
  if (!e) return 'auth/missing-email';
  if (!EMAIL_RE.test(e) || e.length > 254) return 'auth/invalid-email';
  if (password === undefined) return '';            // reset: email only
  if (!password) return 'auth/missing-password';
  if (creating && String(password).length < MIN_PASSWORD) return 'auth/weak-password';
  if (creating && confirm !== undefined && confirm !== password) return 'mdo/password-mismatch';
  return '';
}

/** Is Google sign-in switched on for this page? (window.__ENV__ / window.__CONFIG / meta). Default off. */
export function googleSignInEnabled(win = (typeof window !== 'undefined' ? window : undefined)) {
  try {
    const on = v => v === true || v === 'true';
    if (!win) return false;
    if (on(win.__ENV__ && win.__ENV__.GOOGLE_SIGN_IN)) return true;
    if (on(win.__CONFIG && win.__CONFIG.googleSignIn)) return true;
    const d = win.document;
    const m = d && d.querySelector('meta[name="env-GOOGLE_SIGN_IN"]');
    if (m && on(m.getAttribute('content'))) return true;
    const fb = d && d.querySelector('meta[name="firebase-config"]');
    if (fb) { try { return on(JSON.parse(fb.getAttribute('content') || '{}').googleSignIn); } catch { /* bad meta */ } }
  } catch { /* no DOM */ }
  return false;
}

// ── Actions (exported for tests; `sdk` is the firebase-auth module) ──────────

/** Create an account. A guest session is linked (same uid), so its saved history carries over. */
export async function emailSignUp(sdk, auth, email, password) {
  const bad = validateCredentials(email, password, { creating: true });
  if (bad) throw new AuthUiError(bad);
  const addr = String(email).trim();
  const cur = auth && auth.currentUser;
  try {
    if (cur && cur.isAnonymous) {
      const cred = sdk.EmailAuthProvider.credential(addr, password);
      const res = await sdk.linkWithCredential(cur, cred);
      return { user: res.user, linked: true };
    }
    const res = await sdk.createUserWithEmailAndPassword(auth, addr, password);
    return { user: res.user, linked: false };
  } catch (e) { throw toUiError(e); }
}

/** Sign in to an existing account. */
export async function emailSignIn(sdk, auth, email, password) {
  const bad = validateCredentials(email, password);
  if (bad) throw new AuthUiError(bad);
  try {
    const res = await sdk.signInWithEmailAndPassword(auth, String(email).trim(), password);
    return { user: res.user, linked: false };
  } catch (e) { throw toUiError(e); }
}

/**
 * Send a password-reset email. Resolves true whether or not the address has an account (the copy says
 * "if an account exists"), so the form never reveals who has one.
 */
export async function sendReset(sdk, auth, email, continueUrl) {
  const bad = validateCredentials(email);
  if (bad) throw new AuthUiError(bad);
  const addr = String(email).trim();
  try {
    try {
      await sdk.sendPasswordResetEmail(auth, addr, continueUrl ? { url: continueUrl } : undefined);
    } catch (e) {
      // A preview host is not an authorized continue URL: send the plain reset email instead.
      if (continueUrl && e && (e.code === 'auth/unauthorized-continue-uri' || e.code === 'auth/invalid-continue-uri')) {
        await sdk.sendPasswordResetEmail(auth, addr);
      } else { throw e; }
    }
  } catch (e) {
    if (e && (e.code === 'auth/user-not-found')) return true;
    throw toUiError(e);
  }
  return true;
}

/** Google sign-in (popup). A guest session is linked when possible; otherwise it signs in. */
export async function googleSignIn(sdk, auth) {
  const provider = new sdk.GoogleAuthProvider();
  const resolver = sdk.browserPopupRedirectResolver;
  const cur = auth && auth.currentUser;
  try {
    if (cur && cur.isAnonymous) {
      try {
        const res = await sdk.linkWithPopup(cur, provider, resolver);
        return { user: res.user, linked: true };
      } catch (e) {
        // That Google account already has an mdothree account: sign in to it (guest data stays behind).
        const cred = e && e.code === 'auth/credential-already-in-use' && sdk.GoogleAuthProvider.credentialFromError
          ? sdk.GoogleAuthProvider.credentialFromError(e) : null;
        if (!cred) throw e;
        const res = await sdk.signInWithCredential(auth, cred);
        return { user: res.user, linked: false };
      }
    }
    const res = await sdk.signInWithPopup(auth, provider, resolver);
    return { user: res.user, linked: false };
  } catch (e) { throw toUiError(e); }
}

// ── Dialog ──────────────────────────────────────────────────────────────────

const COPY = {
  signin: { title: 'Sign in', submit: 'Sign in', busy: 'Signing in…' },
  signup: { title: 'Create your mdothree account', submit: 'Create account', busy: 'Creating account…' },
  reset:  { title: 'Reset your password', submit: 'Send reset link', busy: 'Sending…' },
};
const INTRO = 'One mdothree account works on every mdothree tool. Pro is a paid subscription that belongs to your account.';
const RESET_SENT = "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder, then sign in with the new password.";
const GUEST_LINK_NOTE = 'History saved in this browser moves to your new account.';
const GUEST_SIGNIN_NOTE = 'Signing in to an existing account does not move history saved as a guest. To keep it, create an account instead.';

let _open = null;   // { close } while a dialog is showing

/**
 * Open the sign-in dialog. Resolves to the signed-in Firebase user, or null if closed.
 * @param {{ getAuth: () => Promise<object>, loadSdk?: () => Promise<object>, mode?: 'signin'|'signup'|'reset',
 *           reason?: string, google?: boolean, doc?: Document }} opts
 */
export function openAuthDialog(opts = {}) {
  const d = opts.doc || document;
  if (_open) _open.close(null);
  const loadSdk = opts.loadSdk || (() => import(SDK_AUTH_URL));
  const google = opts.google === undefined ? googleSignInEnabled() : !!opts.google;
  let mode = COPY[opts.mode] ? opts.mode : 'signin';
  let ready = null;   // Promise<{ sdk, auth }>
  const prepare = () => {
    if (!ready) {
      ready = Promise.all([loadSdk(), opts.getAuth()]).then(([sdk, auth]) => {
        if (!sdk || !auth) throw new AuthUiError('mdo/sdk-unavailable');
        return { sdk, auth };
      });
      ready.catch(() => { ready = null; });   // allow a retry after a failed load
    }
    return ready;
  };
  prepare().catch(() => {});   // start loading while the visitor types

  injectStyles(d);
  const prevFocus = d.activeElement;
  const el = (tag, attrs = {}, text) => {
    const n = d.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };

  const overlay = el('div', { class: 'mdo-auth-overlay', id: 'mdo-auth-overlay' });
  const box = el('div', { class: 'mdo-auth', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mdo-auth-title' });
  const close = el('button', { type: 'button', class: 'mdo-auth-close', 'aria-label': 'Close' }, '✕');
  const title = el('h2', { id: 'mdo-auth-title', class: 'mdo-auth-title' });
  const intro = el('p', { class: 'mdo-auth-intro' }, opts.reason ? String(opts.reason) : INTRO);
  const form = el('form', { class: 'mdo-auth-form', novalidate: '' });
  const emailL = el('label', { class: 'mdo-auth-label', for: 'mdo-auth-email' }, 'Email');
  const email = el('input', { id: 'mdo-auth-email', type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email', required: '', maxlength: '254' });
  const pwL = el('label', { class: 'mdo-auth-label', for: 'mdo-auth-password' }, 'Password');
  const pw = el('input', { id: 'mdo-auth-password', type: 'password', name: 'password', required: '', maxlength: '128' });
  const pw2L = el('label', { class: 'mdo-auth-label', for: 'mdo-auth-password2' }, 'Confirm password');
  const pw2 = el('input', { id: 'mdo-auth-password2', type: 'password', name: 'password2', autocomplete: 'new-password', maxlength: '128' });
  const hint = el('p', { class: 'mdo-auth-hint', id: 'mdo-auth-hint' }, `At least ${MIN_PASSWORD} characters.`);
  const note = el('p', { class: 'mdo-auth-note' });
  const msg = el('p', { class: 'mdo-auth-msg', role: 'alert', 'aria-live': 'assertive' });
  const submit = el('button', { type: 'submit', class: 'mdo-auth-submit' });
  const forgot = el('button', { type: 'button', class: 'mdo-auth-link' }, 'Forgot password?');
  const swap = el('p', { class: 'mdo-auth-swap' });
  const swapBtn = el('button', { type: 'button', class: 'mdo-auth-link' });
  const gBtn = google ? el('button', { type: 'button', class: 'mdo-auth-google' }, 'Continue with Google') : null;
  const or = google ? el('p', { class: 'mdo-auth-or' }, 'or') : null;
  const legal = el('p', { class: 'mdo-auth-legal' });
  legal.append('By creating an account you agree to the ',
    el('a', { href: 'https://mdothree.com/terms', target: '_blank', rel: 'noopener' }, 'Terms'), ' and ',
    el('a', { href: 'https://mdothree.com/privacy', target: '_blank', rel: 'noopener' }, 'Privacy Policy'), '.');

  form.append(emailL, email, pwL, pw, pw2L, pw2, hint, note, msg, submit);
  box.append(close, title, intro);
  if (gBtn) box.append(gBtn, or);
  box.append(form, forgot, swap, legal);
  swap.append(swapBtn);
  overlay.append(box);
  d.body.append(overlay);

  let busy = false;
  const setMsg = (text, ok) => { msg.textContent = text || ''; msg.classList.toggle('is-ok', !!ok); };
  let guest = false;
  prepare().then(({ auth }) => { guest = !!(auth.currentUser && auth.currentUser.isAnonymous); render(); }, () => {});

  function render() {
    const c = COPY[mode];
    title.textContent = c.title;
    submit.textContent = c.submit;
    const showPw = mode !== 'reset';
    pwL.hidden = pw.hidden = !showPw;
    pw2L.hidden = pw2.hidden = hint.hidden = mode !== 'signup';
    pw.setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
    if (mode === 'signup') pw.setAttribute('aria-describedby', 'mdo-auth-hint'); else pw.removeAttribute('aria-describedby');
    forgot.hidden = mode !== 'signin';
    legal.hidden = mode !== 'signup';
    if (gBtn) gBtn.hidden = or.hidden = mode === 'reset';
    note.textContent = guest ? (mode === 'signup' ? GUEST_LINK_NOTE : mode === 'signin' ? GUEST_SIGNIN_NOTE : '') : '';
    note.hidden = !note.textContent;
    swap.replaceChildren();
    if (mode === 'signin') { swap.append('New to mdothree? ', swapBtn); swapBtn.textContent = 'Create an account'; }
    else if (mode === 'signup') { swap.append('Already have an account? ', swapBtn); swapBtn.textContent = 'Sign in'; }
    else { swap.append(swapBtn); swapBtn.textContent = 'Back to sign in'; }
  }

  let resolveFn;
  const done = new Promise(r => { resolveFn = r; });
  function finish(user) {
    if (!overlay.isConnected) return;
    overlay.remove();
    d.removeEventListener('keydown', onKey, true);
    _open = null;
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch { /* gone */ }
    resolveFn(user || null);
  }
  function onKey(e) {
    if (e.key === 'Escape' && !busy) { e.preventDefault(); finish(null); return; }
    if (e.key === 'Tab') {   // keep focus inside the dialog
      const f = [...box.querySelectorAll('button, input, a[href]')].filter(n => !n.hidden && !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  d.addEventListener('keydown', onKey, true);
  close.addEventListener('click', () => { if (!busy) finish(null); });
  overlay.addEventListener('click', e => { if (e.target === overlay && !busy) finish(null); });
  forgot.addEventListener('click', () => { mode = 'reset'; setMsg(''); render(); email.focus(); });
  swapBtn.addEventListener('click', () => { mode = mode === 'signin' ? 'signup' : 'signin'; setMsg(''); render(); email.focus(); });

  async function run(action) {
    if (busy) return;
    busy = true;
    setMsg('');
    submit.disabled = true; if (gBtn) gBtn.disabled = true;
    const label = submit.textContent;
    submit.textContent = COPY[mode].busy;
    try {
      const { sdk, auth } = await prepare().catch(() => { throw new AuthUiError('mdo/sdk-unavailable'); });
      const out = await action(sdk, auth);
      busy = false;
      if (out === 'reset-sent') {
        submit.disabled = false; if (gBtn) gBtn.disabled = false;
        submit.textContent = label;
        setMsg(RESET_SENT, true);
        return;
      }
      finish(out.user);
    } catch (e) {
      busy = false;
      submit.disabled = false; if (gBtn) gBtn.disabled = false;
      submit.textContent = label;
      setMsg(e instanceof AuthUiError ? e.message : authErrorMessage(e));
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const m = mode;
    if (m === 'signup') {
      const bad = validateCredentials(email.value, pw.value, { creating: true, confirm: pw2.value });
      if (bad) { setMsg(AUTH_MESSAGES[bad]); return; }
      run((sdk, auth) => emailSignUp(sdk, auth, email.value, pw.value));
    } else if (m === 'signin') {
      run((sdk, auth) => emailSignIn(sdk, auth, email.value, pw.value));
    } else {
      const here = (typeof location !== 'undefined' && /^https:$/.test(location.protocol)) ? location.origin + location.pathname : undefined;
      run((sdk, auth) => sendReset(sdk, auth, email.value, here).then(() => 'reset-sent'));
    }
  });
  if (gBtn) gBtn.addEventListener('click', () => run((sdk, auth) => googleSignIn(sdk, auth)));

  render();
  _open = { close: finish };
  setTimeout(() => { try { email.focus(); } catch { /* detached */ } }, 0);
  return done;
}

/** Close an open dialog (resolves its promise with null). */
export function closeAuthDialog() { if (_open) _open.close(null); }

function injectStyles(d) {
  if (d.getElementById('mdo-auth-styles')) return;
  const s = d.createElement('style');
  s.id = 'mdo-auth-styles';
  s.textContent = `
.mdo-auth-overlay{position:fixed;inset:0;z-index:10050;background:rgba(2,6,23,.62);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;padding:16px}
.mdo-auth{--a-bg:#fff;--a-fg:#0F172A;--a-mute:#475569;--a-line:#CBD5E1;--a-in:#F8FAFC;--a-acc:#047857;--a-acc-h:#065F46;--a-err:#B91C1C;--a-ok:#047857;
  position:relative;background:var(--a-bg);color:var(--a-fg);width:100%;max-width:400px;max-height:92vh;overflow-y:auto;
  border-radius:16px;padding:28px 24px 20px;box-shadow:0 24px 80px rgba(0,0,0,.35);font-family:'DM Sans',system-ui,sans-serif;box-sizing:border-box}
:root[data-theme="dark"] .mdo-auth{--a-bg:#0F172A;--a-fg:#F1F5F9;--a-mute:#94A3B8;--a-line:#334155;--a-in:#1E293B;--a-acc:#10B981;--a-acc-h:#34D399;--a-err:#FCA5A5;--a-ok:#34D399}
.mdo-auth *{box-sizing:border-box}
.mdo-auth [hidden]{display:none!important}
.mdo-auth-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:var(--a-mute);cursor:pointer;font-size:1rem}
.mdo-auth-close:hover{color:var(--a-fg);background:var(--a-in)}
.mdo-auth-title{font-size:1.25rem;margin:0 0 6px;font-weight:700;color:var(--a-fg)}
.mdo-auth-intro{font-size:.85rem;color:var(--a-mute);margin:0 0 16px;line-height:1.45}
.mdo-auth-form{display:flex;flex-direction:column;gap:6px}
.mdo-auth-label{font-size:.8rem;font-weight:600;color:var(--a-fg);margin-top:6px}
.mdo-auth input{width:100%;padding:10px 12px;font-size:16px;border:1px solid var(--a-line);border-radius:8px;background:var(--a-in);color:var(--a-fg)}
.mdo-auth input:focus{outline:2px solid var(--a-acc);outline-offset:1px}
.mdo-auth-hint,.mdo-auth-note{font-size:.75rem;color:var(--a-mute);margin:2px 0 0}
.mdo-auth-msg{font-size:.82rem;color:var(--a-err);min-height:1.2em;margin:6px 0 0}
.mdo-auth-msg.is-ok{color:var(--a-ok)}
.mdo-auth-submit,.mdo-auth-google{width:100%;padding:12px;border-radius:10px;font-size:.95rem;font-weight:700;cursor:pointer;margin-top:6px}
.mdo-auth-submit{border:0;background:var(--a-acc);color:#fff}
:root[data-theme="dark"] .mdo-auth-submit{color:#020617}
.mdo-auth-submit:hover:not(:disabled){background:var(--a-acc-h)}
.mdo-auth-google{border:1px solid var(--a-line);background:var(--a-in);color:var(--a-fg)}
.mdo-auth-submit:disabled,.mdo-auth-google:disabled{opacity:.6;cursor:not-allowed}
.mdo-auth-or{text-align:center;font-size:.75rem;color:var(--a-mute);margin:10px 0 2px}
.mdo-auth-link{background:none;border:0;padding:0;color:var(--a-acc);text-decoration:underline;cursor:pointer;font:inherit;font-size:.82rem}
.mdo-auth>.mdo-auth-link{display:block;margin:10px 0 0}
.mdo-auth-swap{font-size:.82rem;color:var(--a-mute);margin:10px 0 0}
.mdo-auth-legal{font-size:.72rem;color:var(--a-mute);margin:12px 0 0}
.mdo-auth-legal a{color:var(--a-acc)}
@media (max-width:420px){.mdo-auth{padding:24px 16px 16px}}`;
  d.head.append(s);
}
