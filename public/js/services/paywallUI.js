// services/paywallUI.js
// The upgrade modal and Pro locks for this tool. mdothree Pro is ONE lifetime purchase
// (DECISIONS 2026-10-16): $29 once, no subscription, Pro never expires.
// Buying happens only on Stripe-hosted Checkout (createCheckout('lifetime') in pro-api.js);
// the Stripe webhook grants Pro. No card form is rendered on this page.
// Also exports proGate() — call before any Pro feature to check and prompt.

import { isProAsync, onSubscriptionChange, refreshSubscription } from './subscriptionService.js';
import { STRIPE_CONFIG, PRO_FEATURES, proFeatureLabel, PRO_CHECKOUT_ENABLED } from '../config/config.js';
import { getFirebaseAuth, loadFirebase } from '../config/config.js';
// mdothree-api client: Bearer <Firebase ID token>, guests refused, no uid in bodies,
// {success:false,error,code} mapped to honest messages.
import { createCheckout, createPortal, signedInUser, ProApiError, proErrorMessage, PRO_OFFER } from '../pro-api.js';


// ── Stripe test mode banner ──────────────────────────────────
// Shows a visible banner when using test-mode keys so
// developers don't accidentally go live with test credentials.
import { IS_TEST_MODE, IS_CONFIGURED } from '../config/config.js';

function injectTestModeBanner() {
  if (!IS_TEST_MODE && IS_CONFIGURED) return;
  if (document.getElementById('__stripe_test_banner')) return;

  const banner = document.createElement('div');
  banner.id = '__stripe_test_banner';
  Object.assign(banner.style, {
    position:        'fixed',
    top:             '0',
    left:            '0',
    right:           '0',
    zIndex:          '99998',
    background:      IS_CONFIGURED ? '#F59E0B' : '#EF4444',
    color:           '#fff',
    textAlign:       'center',
    padding:         '6px 12px',
    fontSize:        '0.78rem',
    fontFamily:      'DM Mono, monospace',
    fontWeight:      '500',
    letterSpacing:   '0.04em',
  });
  banner.textContent = IS_CONFIGURED
    ? '⚠ STRIPE TEST MODE — payments will not be charged'
    : '⚠ CONFIG NOT SET — Firebase/Stripe config meta tags are missing';
  document.body.prepend(banner);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTestModeBanner);
  } else {
    injectTestModeBanner();
  }
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The real Pro features of THIS tool (config/stripe.js lists only what the code gates).
function toolPerks() {
  return Object.values(PRO_FEATURES).map(f => f.label);
}

const CTA_LABEL     = `Get Pro, ${PRO_OFFER.price} once`;
const SIGN_IN_LABEL = 'Sign in to get Pro';

// ---- Styles injected once ----
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    /* ---- Paywall overlay ---- */
    .pw-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; animation: pw-fadein 180ms ease;
    }
    @keyframes pw-fadein { from { opacity: 0 } to { opacity: 1 } }

    .pw-modal {
      background: #fff; color: #0F172A; border-radius: 4px; width: 100%; max-width: 520px;
      max-height: calc(100vh - 32px); overflow: auto;
      box-shadow: 0 24px 80px rgba(0,0,0,0.22);
      font-family: 'DM Sans', sans-serif;
      animation: pw-slidein 220ms ease-out;
    }
    @keyframes pw-slidein { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    @media (prefers-reduced-motion: reduce) { .pw-overlay, .pw-modal { animation: none; } }

    .pw-header {
      background: #0F172A;
      padding: 28px 28px 24px; color: #fff; position: relative;
    }
    .pw-close {
      position: absolute; top: 12px; right: 12px;
      background: rgba(255,255,255,0.1); border: none; border-radius: 4px;
      width: 44px; height: 44px; color: #fff; cursor: pointer;
      font-size: 1rem; display: flex; align-items: center; justify-content: center;
      transition: background 150ms;
    }
    .pw-close:hover { background: rgba(255,255,255,0.2); }
    .pw-badge {
      display: inline-flex; align-items: center; gap: 6px;
      color: #34D399; border: 1px solid rgba(52,211,153,0.4); border-radius: 4px;
      padding: 4px 10px; font-size: 0.72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
    }
    .pw-title {
      font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 800;
      letter-spacing: -0.02em; margin-bottom: 6px; color: #fff;
    }
    .pw-subtitle { font-size: 0.875rem; color: #CBD5E1; }
    .pw-locked-feature {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid rgba(252,165,165,0.4); color: #FCA5A5;
      border-radius: 4px; padding: 4px 10px; font-size: 0.78rem;
      margin-top: 10px; font-weight: 500;
    }

    .pw-body { padding: 24px 28px; }

    /* The one offer */
    .pw-offer {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      border: 1px solid #CBD5E1; border-radius: 4px; padding: 12px 14px; margin-bottom: 18px;
    }
    .pw-offer-price { font-size: 1.4rem; font-weight: 800; color: #047857; }
    .pw-offer-note { font-size: 0.82rem; color: #475569; }

    /* Perks */
    .pw-perks-title { font-size: 0.8rem; font-weight: 700; color: #334155; margin: 0 0 8px; }
    .pw-perks { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .pw-perk { display: flex; align-items: flex-start; gap: 10px; font-size: 0.875rem; }
    .pw-perk-icon { color: #047857; font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
    .pw-scope { font-size: 0.8rem; color: #475569; margin: 0 0 18px; }

    #pw-status { margin-bottom: 12px; font-size: 0.85rem; color: #475569; min-height: 20px; }

    .pw-submit {
      width: 100%; min-height: 48px; padding: 14px; background: #047857; color: #fff; /* A11Y-003: white text 5.5:1 */
      border: none; border-radius: 4px; font-family: 'DM Sans', sans-serif;
      font-size: 0.95rem; font-weight: 700; cursor: pointer; letter-spacing: 0.01em;
      transition: background 150ms; display: flex;
      align-items: center; justify-content: center; gap: 8px;
    }
    .pw-submit:hover:not(:disabled) { background: #065F46; }
    .pw-submit:disabled, .pw-submit[aria-disabled="true"] { opacity: 0.6; cursor: not-allowed; }

    .pw-error { color: #B91C1C; font-size: 0.82rem; margin-top: 8px; min-height: 20px; }
    .pw-legal {
      text-align: center; font-size: 0.75rem; color: #475569; margin-top: 12px;
    }
    .pw-legal a { color: #047857; text-decoration: underline; }

    .pw-receipts {
      display: block; width: 100%; min-height: 44px; margin-top: 8px; background: none; border: none;
      color: #475569; font-family: inherit; font-size: 0.8rem; text-decoration: underline; cursor: pointer;
    }
    .pw-receipts:hover { color: #047857; }

    /* Pro badge shown in nav/header for a Pro account */
    .pro-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: #047857;
      color: #fff; border-radius: 4px; padding: 2px 10px;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    /* Feature lock overlay (used on gated UI sections) */
    .pro-gate-wrap { position: relative; }
    .pro-gate-lock {
      position: absolute; inset: 0; z-index: 10;
      background: rgba(255,255,255,0.82); backdrop-filter: blur(3px);
      border-radius: inherit; display: flex; align-items: center;
      justify-content: center; flex-direction: column; gap: 10px;
      border: 2px dashed #CBD5E1;
    }
    .pro-gate-lock-label { font-size: 0.85rem; font-weight: 600; color: #0F172A; }
    .pro-gate-lock-btn {
      background: #047857; color: #fff; border: none; border-radius: 4px; /* A11Y-003: 5.5:1 */
      min-height: 44px; padding: 8px 18px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
      font-weight: 600; cursor: pointer; transition: background 150ms;
    }
    .pro-gate-lock-btn:hover { background: #065F46; }
  `;
  document.head.appendChild(style);
}

// ---- Modal state ----
let _modalEl = null;

/**
 * Open the upgrade modal for a specific locked feature.
 * @param {string} featureId  — key from PRO_FEATURES
 */
export async function openUpgradeModal(featureId = '') {
  injectStyles();
  if (_modalEl) return; // already open
  loadFirebase(); // PERF-002: the Pro UI is where the SDK loads on demand

  const featureLabel = esc(featureId ? proFeatureLabel(featureId) : 'Pro features');
  const perks = toolPerks().map(l => `<li class="pw-perk"><span class="pw-perk-icon" aria-hidden="true">✓</span><span>${esc(l)}</span></li>`).join('');

  _modalEl = document.createElement('div');
  _modalEl.className = 'pw-overlay';
  _modalEl.innerHTML = `
    <div class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <div class="pw-header">
        <button class="pw-close" aria-label="Close" id="pw-close-btn">✕</button>
        <div class="pw-badge">mdothree Pro · lifetime</div>
        <div class="pw-title" id="pw-title">Unlock ${featureLabel}</div>
        <div class="pw-subtitle">${esc(PRO_OFFER.price)} once. No subscription. Pro never expires.</div>
        ${featureId ? `<div class="pw-locked-feature">🔒 ${featureLabel} is part of Pro</div>` : ''}
      </div>
      <div class="pw-body">
        <div class="pw-offer" id="pw-offer">
          <span class="pw-offer-price">${esc(PRO_OFFER.price)} once · lifetime</span>
          <span class="pw-offer-note">${esc(PRO_OFFER.note)}</span>
        </div>

        <p class="pw-perks-title" id="pw-perks-title">Pro in this tool</p>
        <ul class="pw-perks">${perks}</ul>
        <p class="pw-scope">Pro belongs to your mdothree account and also unlocks the Pro features of the other mdothree tools where you sign in.</p>

        <!-- Checkout status (payment itself happens on Stripe's hosted Checkout page) -->
        <div id="pw-status" role="status" aria-live="polite">Preparing secure checkout…</div>
        <div class="pw-error" id="pw-error" role="alert"></div>

        <button class="pw-submit" id="pw-submit-btn" disabled>
          <span id="pw-submit-label">Loading…</span>
        </button>

        <div class="pw-legal">
          One payment of ${esc(PRO_OFFER.price)} on Stripe's secure checkout page. By buying you agree to our
          <a href="https://mdothree.com/terms">Terms</a> and <a href="https://mdothree.com/refund">Refund policy</a>.
        </div>
        <button type="button" class="pw-receipts" id="pw-receipts-btn">Already bought Pro? Receipts</button>
      </div>
    </div>
  `;

  document.body.appendChild(_modalEl);

  // Close on backdrop click
  _modalEl.addEventListener('click', e => {
    if (e.target === _modalEl) closeUpgradeModal();
  });
  document.getElementById('pw-close-btn').addEventListener('click', closeUpgradeModal);

  if (!PRO_CHECKOUT_ENABLED) {
    // #66b: Pro checkout isn't open. No price, no checkout, no receipts link.
    ['#pw-offer', '#pw-status', '#pw-error', '.pw-legal', '.pw-receipts']
      .forEach(sel => _modalEl.querySelector(sel)?.remove());
    _modalEl.querySelector('.pw-badge').textContent = 'mdothree Pro · coming soon';
    _modalEl.querySelector('.pw-title').textContent = 'Pro is coming soon';
    _modalEl.querySelector('.pw-subtitle').textContent =
      "Pro checkout isn't open yet, so there is nothing to buy today.";
    _modalEl.querySelector('#pw-perks-title').textContent = 'Planned for Pro in this tool';
    const locked = _modalEl.querySelector('.pw-locked-feature');
    if (locked) locked.textContent = `🔒 ${proFeatureLabel(featureId)} will be part of Pro`;
    document.getElementById('pw-submit-label').textContent = 'Pro coming soon';
    document.getElementById('pw-submit-btn').setAttribute('aria-disabled', 'true');
    return;
  }

  await prepareCheckout();
}

// Hosted Stripe Checkout through the hardened API (createCheckoutSession, plan 'lifetime',
// Bearer ID token). The server fixes the price and the success/cancel URLs.
// Guests are asked to sign in first.
async function prepareCheckout() {
  const statusEl   = document.getElementById('pw-status');
  const submitBtn  = document.getElementById('pw-submit-btn');
  const errorEl    = document.getElementById('pw-error');
  const labelEl    = document.getElementById('pw-submit-label');
  const receiptBtn = document.getElementById('pw-receipts-btn');
  if (!statusEl || !submitBtn) return;

  await loadFirebase(); // PERF-002: loaded here, when the Pro UI opens
  if (!_modalEl) return; // closed while loading
  const apiOpts = () => ({ baseUrl: STRIPE_CONFIG.functionsBaseUrl, auth: getFirebaseAuth() });
  const showState = () => {
    if (signedInUser(getFirebaseAuth())) {
      statusEl.textContent = "You'll pay once on Stripe's secure checkout page, then come back to mdothree.";
      labelEl.textContent = CTA_LABEL;
    } else {
      statusEl.textContent = proErrorMessage(401, 'sign_in_required');
      labelEl.textContent = SIGN_IN_LABEL;
    }
    submitBtn.disabled = false;
    submitBtn.removeAttribute('aria-disabled');
  };
  showState();

  // Sign in or create an account first (js/auth-ui.js, loaded now). A guest session is linked to the
  // new account, so history saved here carries over. Returns true once signed in.
  const ensureSignedIn = async () => {
    if (signedInUser(getFirebaseAuth())) return true;
    const { openSignIn } = await import('../auth-nav.js');
    const signed = await openSignIn({ reason: 'Pro belongs to your mdothree account. Sign in or create one, then continue to checkout.' }).catch(() => null);
    return !!(signed && signedInUser(getFirebaseAuth()));
  };

  submitBtn.addEventListener('click', async () => {
    if (!signedInUser(getFirebaseAuth())) {
      if (!await ensureSignedIn()) { showState(); return; }
      const status = await refreshSubscription();
      if (status && status.isPro) { closeUpgradeModal(); showProSuccessToast(); return; }   // already Pro
      showState();
      return;   // signed in: the next press goes to checkout
    }
    submitBtn.disabled = true;
    labelEl.textContent = 'Opening secure checkout…';
    errorEl.textContent = '';
    try {
      const url = await createCheckout(PRO_OFFER.plan, apiOpts());
      window.location.assign(url);
    } catch (e) {
      errorEl.textContent = e instanceof ProApiError ? e.message : proErrorMessage(500, 'internal');
      submitBtn.disabled = false;
      labelEl.textContent = CTA_LABEL;
    }
  });

  // Receipts: the Stripe Customer Portal for the signed-in account.
  receiptBtn?.addEventListener('click', async () => {
    errorEl.textContent = '';
    if (!await ensureSignedIn()) { showState(); return; }
    showState();
    try {
      const url = await createPortal(window.location.href, apiOpts());
      window.location.assign(url);
    } catch (e) {
      errorEl.textContent = e instanceof ProApiError ? e.message : proErrorMessage(500, 'internal');
    }
  });
}

export function closeUpgradeModal() {
  if (_modalEl) { _modalEl.remove(); _modalEl = null; }
}

// ---- Handle Stripe redirect success ----
export async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('stripe_success') !== '1') return;
  // Remove query param without reload
  const url = new URL(window.location);
  url.searchParams.delete('stripe_success');
  history.replaceState({}, '', url);
  // Refresh Pro status (the webhook may take a moment)
  let attempts = 0;
  while (attempts++ < 6) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await refreshSubscription();
    if (status?.isPro) {
      showProSuccessToast();
      return;
    }
  }
}

function showProSuccessToast() {
  injectStyles();
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#0F172A', 'color:#fff', 'padding:14px 24px', 'border-radius:4px',
    'font-family:"DM Sans",sans-serif', 'font-size:0.9rem', 'font-weight:600',
    'z-index:99999', 'display:flex', 'align-items:center', 'gap:10px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.3)',
  ].join(';');
  toast.innerHTML = '<span style="color:#10B981;font-size:1.2rem" aria-hidden="true">✓</span> Pro is on for this account, for good.';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ---- proGate() — main feature gate function ----
/**
 * Check if the user can access a Pro feature. If not, open the upgrade modal.
 * Usage: if (!await proGate('hash.bcrypt')) return;
 *
 * @param {string} featureId
 * @returns {Promise<boolean>} true = allowed, false = blocked (modal opened)
 */
export async function proGate(featureId) {
  const allowed = await isProAsync();
  if (allowed) return true;
  openUpgradeModal(featureId);
  return false;
}

/**
 * Wrap a DOM element with a Pro lock overlay.
 * Clicking the lock button opens the modal.
 * @param {HTMLElement} el
 * @param {string} featureId
 * @param {string} [label]
 */
export function lockElement(el, featureId, label) {
  injectStyles();
  el.classList.add('pro-gate-wrap');
  const lock = document.createElement('div');
  lock.className = 'pro-gate-lock';
  lock.innerHTML = `
    <span style="font-size:1.4rem" aria-hidden="true">🔒</span>
    <span class="pro-gate-lock-label">${esc(label || proFeatureLabel(featureId))}</span>
    <button class="pro-gate-lock-btn">${PRO_CHECKOUT_ENABLED ? `Get Pro, ${esc(PRO_OFFER.price)} once` : 'Pro (coming soon)'}</button>
  `;
  lock.querySelector('.pro-gate-lock-btn').addEventListener('click', () => openUpgradeModal(featureId));
  el.style.position = 'relative';
  el.appendChild(lock);

  // Remove lock once the account has Pro
  onSubscriptionChange(status => {
    if (status.isPro) lock.remove();
  });
}

/**
 * Render a small Pro badge element (inline).
 */
export function proBadge() {
  const span = document.createElement('span');
  span.className = 'pro-badge';
  span.textContent = '★ Pro';
  return span;
}
