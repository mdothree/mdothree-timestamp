// services/paywallUI.js
// Renders an upgrade modal with embedded Stripe Elements (Payment Element).
// Also exports proGate() — call before any Pro feature to check and prompt.

import { isPro, isProAsync, onSubscriptionChange, refreshSubscription } from './subscriptionService.js';
import { STRIPE_CONFIG, PLANS, proFeatureLabel } from '../config/config.js';
import { getFirebaseAuth, ensureAnonymousUser } from '../config/config.js';

// ---- Stripe.js lazy-load ----
let _stripe = null;
async function loadStripe() {
  if (_stripe) return _stripe;
  if (!window.Stripe) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _stripe = window.Stripe(STRIPE_CONFIG.publishableKey);
  return _stripe;
}


// ── Stripe test mode banner ──────────────────────────────────
// Shows a visible yellow banner when using test-mode keys so
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
    : '⚠ CONFIG NOT SET — replace REPLACE_WITH_* values in meta tags';
  document.body.prepend(banner);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTestModeBanner);
  } else {
    injectTestModeBanner();
  }
}

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
      background: #fff; border-radius: 18px; width: 100%; max-width: 520px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.22);
      overflow: hidden; font-family: 'DM Sans', sans-serif;
      animation: pw-slidein 220ms cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes pw-slidein { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

    .pw-header {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      padding: 28px 28px 24px; color: #fff; position: relative;
    }
    .pw-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,0.1); border: none; border-radius: 8px;
      width: 32px; height: 32px; color: #fff; cursor: pointer;
      font-size: 1rem; display: flex; align-items: center; justify-content: center;
      transition: background 150ms;
    }
    .pw-close:hover { background: rgba(255,255,255,0.2); }
    .pw-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(16,185,129,0.2); color: #34D399;
      border: 1px solid rgba(16,185,129,0.3); border-radius: 99px;
      padding: 4px 12px; font-size: 0.72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
    }
    .pw-title {
      font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 800;
      letter-spacing: -0.02em; margin-bottom: 6px; color: #fff;
    }
    .pw-subtitle { font-size: 0.875rem; color: #94A3B8; }
    .pw-locked-feature {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(239,68,68,0.15); color: #FCA5A5;
      border-radius: 6px; padding: 4px 10px; font-size: 0.78rem;
      margin-top: 10px; font-weight: 500;
    }

    .pw-body { padding: 24px 28px; }

    /* Plan toggle */
    .pw-plan-toggle {
      display: flex; background: #F1F5F9; border-radius: 10px; padding: 4px;
      margin-bottom: 20px; gap: 4px;
    }
    .pw-plan-btn {
      flex: 1; border: none; background: transparent; border-radius: 7px;
      padding: 8px 0; font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
      font-weight: 500; cursor: pointer; color: #64748B; transition: all 150ms;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
    }
    .pw-plan-btn.active {
      background: #fff; color: #0F172A; font-weight: 600;
      box-shadow: 0 1px 6px rgba(0,0,0,0.1);
    }
    .pw-plan-btn .pw-price { font-size: 1rem; font-weight: 700; color: #10B981; }
    .pw-plan-btn .pw-save-badge {
      font-size: 0.65rem; background: #10B981; color: #fff;
      border-radius: 4px; padding: 1px 5px; margin-top: 2px;
    }

    /* Perks */
    .pw-perks { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .pw-perk { display: flex; align-items: flex-start; gap: 10px; font-size: 0.875rem; }
    .pw-perk-icon { color: #10B981; font-size: 1rem; flex-shrink: 0; margin-top: 1px; }

    /* Stripe Elements mount */
    #pw-payment-element { margin-bottom: 16px; min-height: 48px; }
    #pw-payment-element.pw-loading::after {
      content: 'Loading payment form…';
      display: block; padding: 16px; color: #64748B; font-size: 0.85rem;
      text-align: center;
    }

    .pw-submit {
      width: 100%; padding: 14px; background: #10B981; color: #fff;
      border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif;
      font-size: 0.95rem; font-weight: 700; cursor: pointer; letter-spacing: 0.01em;
      transition: background 150ms, transform 100ms; display: flex;
      align-items: center; justify-content: center; gap: 8px;
    }
    .pw-submit:hover:not(:disabled) { background: #059669; }
    .pw-submit:active:not(:disabled) { transform: scale(0.99); }
    .pw-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .pw-error { color: #EF4444; font-size: 0.82rem; margin-top: 8px; min-height: 20px; }
    .pw-legal {
      text-align: center; font-size: 0.72rem; color: #94A3B8; margin-top: 12px;
    }
    .pw-legal a { color: #10B981; text-decoration: none; }

    .pw-manage-link {
      display: block; text-align: center; margin-top: 12px;
      color: #64748B; font-size: 0.8rem; text-decoration: none;
    }
    .pw-manage-link:hover { color: #10B981; }

    /* Pro badge shown in nav/header when active */
    .pro-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg, #10B981, #059669);
      color: #fff; border-radius: 99px; padding: 2px 10px;
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
      background: #10B981; color: #fff; border: none; border-radius: 8px;
      padding: 8px 18px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
      font-weight: 600; cursor: pointer; transition: background 150ms;
    }
    .pro-gate-lock-btn:hover { background: #059669; }
  `;
  document.head.appendChild(style);
}

// ---- Modal state ----
let _modalEl     = null;
let _elements    = null;
let _selectedPlan = 'monthly';

/**
 * Open the upgrade modal for a specific locked feature.
 * @param {string} featureId  — key from PRO_FEATURES
 */
export async function openUpgradeModal(featureId = '') {
  injectStyles();
  if (_modalEl) return; // already open

  const featureLabel = featureId ? proFeatureLabel(featureId) : 'Pro features';

  _modalEl = document.createElement('div');
  _modalEl.className = 'pw-overlay';
  _modalEl.innerHTML = `
    <div class="pw-modal" role="dialog" aria-modal="true" aria-label="Upgrade to Pro">
      <div class="pw-header">
        <button class="pw-close" aria-label="Close" id="pw-close-btn">✕</button>
        <div class="pw-badge">⭐ mdothree Pro</div>
        <div class="pw-title">Unlock ${featureLabel}</div>
        <div class="pw-subtitle">Get full access to every tool across mdothree.com</div>
        ${featureId ? `<div class="pw-locked-feature">🔒 ${featureLabel} requires Pro</div>` : ''}
      </div>
      <div class="pw-body">
        <!-- Plan toggle -->
        <div class="pw-plan-toggle" id="pw-plan-toggle">
          <button class="pw-plan-btn active" data-plan="monthly">
            Monthly
            <span class="pw-price">$4<span style="font-size:0.65rem;font-weight:500;color:#64748B">/mo</span></span>
          </button>
          <button class="pw-plan-btn" data-plan="yearly">
            Yearly
            <span class="pw-price">$3<span style="font-size:0.65rem;font-weight:500;color:#64748B">/mo</span></span>
            <span class="pw-save-badge">Save 25%</span>
          </button>
        </div>

        <!-- Perks -->
        <ul class="pw-perks">
          <li class="pw-perk"><span class="pw-perk-icon">✓</span><span><strong>All Pro tools unlocked</strong> — bcrypt, HMAC, batch hashing, breach checker, cron parser, palette saving, gradient generator, colorblind simulator</span></li>
          <li class="pw-perk"><span class="pw-perk-icon">✓</span><span><strong>Unlimited history</strong> — password, hash, timestamp conversion history synced across devices</span></li>
          <li class="pw-perk"><span class="pw-perk-icon">✓</span><span><strong>Bulk operations</strong> — generate up to 50 passwords at once, batch hash 1000+ strings</span></li>
          <li class="pw-perk"><span class="pw-perk-icon">✓</span><span><strong>Export everything</strong> — CSS vars, SCSS, JSON, CSV for all tool outputs</span></li>
          <li class="pw-perk"><span class="pw-perk-icon">✓</span><span><strong>Priority support</strong> — feature requests and bug reports prioritised</span></li>
        </ul>

        <!-- Stripe Payment Element mount point -->
        <div id="pw-payment-element" class="pw-loading"></div>
        <div class="pw-error" id="pw-error"></div>

        <button class="pw-submit" id="pw-submit-btn" disabled>
          <span id="pw-submit-label">Loading…</span>
        </button>

        <div class="pw-legal">
          By subscribing you agree to our <a href="/terms">Terms</a>.
          Cancel anytime. Powered by <a href="https://stripe.com" target="_blank" rel="noopener">Stripe</a>.
        </div>
        <a class="pw-manage-link" href="${STRIPE_CONFIG.portalUrl}" target="_blank" rel="noopener">
          Already subscribed? Manage billing →
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(_modalEl);

  // Close on backdrop click
  _modalEl.addEventListener('click', e => {
    if (e.target === _modalEl) closeUpgradeModal();
  });
  document.getElementById('pw-close-btn').addEventListener('click', closeUpgradeModal);

  // Plan toggle
  document.getElementById('pw-plan-toggle').addEventListener('click', e => {
    const btn = e.target.closest('[data-plan]');
    if (!btn) return;
    _selectedPlan = btn.dataset.plan;
    document.querySelectorAll('.pw-plan-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateSubmitLabel();
  });

  // Mount Stripe Elements
  await mountStripeElements();

  function updateSubmitLabel() {
    const label = _selectedPlan === 'yearly'
      ? 'Subscribe — $36/year (billed now)'
      : 'Subscribe — $4/month';
    document.getElementById('pw-submit-label').textContent = label;
  }
}

async function mountStripeElements() {
  const stripe = await loadStripe().catch(() => null);
  if (!stripe) {
    document.getElementById('pw-payment-element').textContent = 'Payment unavailable. Please try again later.';
    return;
  }

  // Get current user's email for Stripe (optional)
  const user  = getFirebaseAuth().currentUser;
  const email = user?.email ?? undefined;

  // Create a SetupIntent or PaymentIntent via your Cloud Function
  // Get Firebase ID token for server-side auth verification
  let idToken = '';
  try { if (user) idToken = await user.getIdToken(); } catch { /* anon */ }

  let clientSecret;
  try {
    const res = await fetch('/api/stripe/create-setup-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ uid: user?.uid, email, plan: _selectedPlan }),
    });
    const data = await res.json();
    clientSecret = data.clientSecret;
  } catch {
    // Can't reach backend — show fallback Stripe Checkout link
    const mountEl = document.getElementById('pw-payment-element');
    mountEl.classList.remove('pw-loading');
    mountEl.innerHTML = `
      <div style="text-align:center;padding:16px 0">
        <p style="font-size:0.875rem;color:#64748B;margin-bottom:12px">Click below to complete your subscription securely via Stripe Checkout.</p>
      </div>
    `;
    const submitBtn = document.getElementById('pw-submit-btn');
    submitBtn.disabled = false;
    document.getElementById('pw-submit-label').textContent = 'Continue to Checkout →';
    submitBtn.addEventListener('click', () => {
      const priceId = _selectedPlan === 'yearly'
        ? STRIPE_CONFIG.priceIdYearly
        : STRIPE_CONFIG.priceIdMonthly;
      window.location.href = `https://buy.stripe.com/${priceId}?client_reference_id=${user?.uid ?? ''}`;
    });
    return;
  }

  // Mount Stripe Payment Element
  _elements = stripe.elements({ clientSecret, appearance: stripeAppearance() });
  const paymentEl = _elements.create('payment', { layout: 'tabs' });
  const mountEl   = document.getElementById('pw-payment-element');
  mountEl.classList.remove('pw-loading');
  mountEl.innerHTML = '';
  paymentEl.mount(mountEl);

  const submitBtn = document.getElementById('pw-submit-btn');
  submitBtn.disabled = false;
  document.getElementById('pw-submit-label').textContent =
    _selectedPlan === 'yearly' ? 'Subscribe — $36/year' : 'Subscribe — $4/month';

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    document.getElementById('pw-submit-label').textContent = 'Processing…';
    document.getElementById('pw-error').textContent = '';

    const { error } = await stripe.confirmPayment({
      elements:      _elements,
      confirmParams: {
        return_url: window.location.href + '?stripe_success=1',
      },
    });

    if (error) {
      document.getElementById('pw-error').textContent = error.message;
      submitBtn.disabled = false;
      document.getElementById('pw-submit-label').textContent =
        _selectedPlan === 'yearly' ? 'Subscribe — $36/year' : 'Subscribe — $4/month';
    }
    // On success, Stripe redirects to return_url and the webhook updates Firestore
  });
}

function stripeAppearance() {
  return {
    theme: 'stripe',
    variables: {
      colorPrimary:       '#10B981',
      colorBackground:    '#ffffff',
      colorText:          '#0F172A',
      colorDanger:        '#EF4444',
      fontFamily:         '"DM Sans", system-ui, sans-serif',
      borderRadius:       '8px',
      spacingUnit:        '4px',
    },
    rules: {
      '.Input': {
        border:    '1.5px solid #CBD5E1',
        boxShadow: 'none',
      },
      '.Input:focus': {
        border:    '1.5px solid #10B981',
        boxShadow: '0 0 0 3px rgba(16,185,129,0.12)',
      },
      '.Label': { fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' },
    },
  };
}

export function closeUpgradeModal() {
  if (_modalEl) { _modalEl.remove(); _modalEl = null; _elements = null; }
}

// ---- Handle Stripe redirect success ----
export async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('stripe_success') !== '1') return;
  // Remove query param without reload
  const url = new URL(window.location);
  url.searchParams.delete('stripe_success');
  history.replaceState({}, '', url);
  // Refresh subscription status (webhook may take a moment)
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
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#0F172A', 'color:#fff', 'padding:14px 24px', 'border-radius:12px',
    'font-family:"DM Sans",sans-serif', 'font-size:0.9rem', 'font-weight:600',
    'z-index:99999', 'display:flex', 'align-items:center', 'gap:10px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.3)',
  ].join(';');
  toast.innerHTML = '<span style="color:#10B981;font-size:1.2rem">✓</span> Welcome to Pro! All features unlocked.';
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
 * Clicking "Upgrade" on the overlay opens the modal.
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
    <span style="font-size:1.4rem">🔒</span>
    <span class="pro-gate-lock-label">${label || proFeatureLabel(featureId)}</span>
    <button class="pro-gate-lock-btn">Upgrade to Pro</button>
  `;
  lock.querySelector('.pro-gate-lock-btn').addEventListener('click', () => openUpgradeModal(featureId));
  el.style.position = 'relative';
  el.appendChild(lock);

  // Remove lock if user upgrades
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
