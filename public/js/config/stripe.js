// config/stripe.js — mdothree shared Stripe config
// Used by all frontend projects via copy or CDN import.
// Stripe Publishable Key is safe to expose in frontend code.

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
    publishableKey: 'REPLACE_WITH_STRIPE_PUBLISHABLE_KEY',
    priceIdMonthly: 'REPLACE_WITH_STRIPE_PRICE_ID_MONTHLY',  // e.g. price_1ABC...
    priceIdYearly:  'REPLACE_WITH_STRIPE_PRICE_ID_YEARLY',   // e.g. price_1XYZ...
    portalUrl:      'https://billing.stripe.com/p/login/REPLACE', // customer portal link
  };
}

export const STRIPE_CONFIG = loadStripeConfig();

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------
export const PLANS = {
  free: {
    name:  'Free',
    price: '$0/mo',
    color: '#64748B',
  },
  pro: {
    name:  'Pro',
    price: '$4/mo',
    yearly: '$36/yr',
    color: '#10B981',
  },
};

// ---------------------------------------------------------------------------
// Feature gate map — defines which features require Pro
// Each key matches a feature ID checked via requiresPro(featureId)
// ---------------------------------------------------------------------------
export const PRO_FEATURES = {
  // ---- Hash ----
  'hash.bcrypt':          { label: 'bcrypt hashing',             tool: 'hash' },
  'hash.hmac':            { label: 'HMAC generation',            tool: 'hash' },
  'hash.batch':           { label: 'Batch hashing (>10 items)',  tool: 'hash' },
  'hash.batch_unlimited': { label: 'Unlimited batch hashing',    tool: 'hash' },
  'hash.favourites':      { label: 'Save hash favourites',       tool: 'hash' },
  'hash.history':         { label: 'Hash history (>5 entries)',  tool: 'hash' },
  'hash.file_check':      { label: 'File hash verification',     tool: 'hash' },

  // ---- Password ----
  'password.breach':      { label: 'Breach checker',             tool: 'password' },
  'password.history':     { label: 'Password history (>5)',      tool: 'password' },
  'password.passphrase':  { label: 'Passphrase generator',       tool: 'password' },
  'password.bulk':        { label: 'Bulk generate (>5 at once)', tool: 'password' },
  'password.bookmarklet': { label: 'Browser bookmarklet',        tool: 'password' },

  // ---- Timestamp ----
  'timestamp.cron':       { label: 'Cron expression parser',     tool: 'timestamp' },
  'timestamp.presets':    { label: 'Saved timezone presets',     tool: 'timestamp' },
  'timestamp.history':    { label: 'Conversion history',        tool: 'timestamp' },
  'timestamp.business':   { label: 'Business days calculator',  tool: 'timestamp' },
  'timestamp.bulk_export':{ label: 'Bulk export conversions',   tool: 'timestamp' },

  // ---- Color ----
  'color.palette_save':   { label: 'Save palettes',             tool: 'color' },
  'color.palette_limit':  { label: 'More than 3 palettes',      tool: 'color' },
  'color.export_formats': { label: 'Export CSS/SCSS/JSON',       tool: 'color' },
  'color.colorblind':     { label: 'Colorblind simulator',       tool: 'color' },
  'color.gradient':       { label: 'Gradient generator',         tool: 'color' },
  'color.image_extract':  { label: 'Extract colors from image',  tool: 'color' },
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
