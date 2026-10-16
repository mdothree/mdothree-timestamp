// config/stripe.js — mdothree Pro config for this tool.
// mdothree Pro is ONE lifetime purchase (DECISIONS 2026-10-16): $29 once, no subscription, never expires.
// The price is fixed on the server (createCheckoutSession, plan 'lifetime'); the values here are display only.
// The publishable key is safe to expose in frontend code.

// ---------------------------------------------------------------------------
// Keys — injected from <meta name="stripe-config"> or window.__STRIPE_CONFIG
// ---------------------------------------------------------------------------
function loadStripeConfig() {
  if (typeof window !== 'undefined') {
    if (window.__STRIPE_CONFIG) return window.__STRIPE_CONFIG;
    const meta = document.querySelector('meta[name="stripe-config"]');
    if (meta) { try { return JSON.parse(meta.content); } catch {} }
  }
  return {
    publishableKey:   '',   // set via <meta name="stripe-config">; empty = checkout fails closed
    functionsBaseUrl: '',   // mdothree-api base; empty = checkout fails closed with an honest message
  };
}

export const STRIPE_CONFIG = loadStripeConfig();

// ---------------------------------------------------------------------------
// The one Pro offer: a single lifetime purchase. No recurring plans.
// ---------------------------------------------------------------------------
export const PLANS = {
  open: {
    name:  'Without Pro',
    color: '#64748B',
  },
  pro: {
    name:  'Pro',
    price: '$29',
    note:  'one payment, lifetime',
    color: '#10B981',
  },
};

// ---------------------------------------------------------------------------
// Feature gate map: ONLY the features this tool really gates in code
// (proGate('<id>') / openUpgradeModal('<id>') in public/js). The upgrade modal
// lists exactly these labels, so keep them honest and in sync with the code.
// ---------------------------------------------------------------------------
export const PRO_FEATURES = {
  'timestamp.cron':       { label: 'Cron expression parser',   tool: 'timestamp' },
  'timestamp.business':   { label: 'Business days calculator', tool: 'timestamp' },
  'timestamp.presets':    { label: 'Saved timezone presets',   tool: 'timestamp' },
};

// ---------------------------------------------------------------------------
// Check if a feature requires Pro
// ---------------------------------------------------------------------------
export function requiresPro(featureId) {
  return featureId in PRO_FEATURES;
}

// ---------------------------------------------------------------------------
// Get the human label for a Pro feature
// ---------------------------------------------------------------------------
export function proFeatureLabel(featureId) {
  return PRO_FEATURES[featureId]?.label ?? featureId;
}
