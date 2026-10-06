#!/usr/bin/env node
// scripts/inject-config.js
// Overrides the firebase-config / stripe-config <meta> tags in all HTML files
// with values from environment variables at build time (Vercel project settings).
//
// IMPORTANT: if the env vars for a config group are NOT set, this script leaves
// the committed meta-tag values UNTOUCHED. The HTML ships with the real public
// client config baked in (Firebase apiKey/projectId and Stripe price links are
// publishable by design), so a build with no env vars is a safe no-op — it will
// never clobber the committed real values back to REPLACE_WITH_* placeholders.
//
// Usage:
//   node scripts/inject-config.cjs
//   (Vercel runs this automatically via the "build" script in package.json)
//
// Optional environment variables (set in Vercel project settings to override):
//   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
//   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
//   STRIPE_PUBLISHABLE_KEY, STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY,
//   STRIPE_CUSTOMER_PORTAL_URL

const fs   = require('fs');
const path = require('path');

// ── Build config override JSON strings, only from env ─────────
const firebaseKeys = [
  'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID',
];
const stripeKeys = [
  'STRIPE_PUBLISHABLE_KEY', 'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_PRICE_ID_YEARLY', 'STRIPE_CUSTOMER_PORTAL_URL',
];

// A config group is only injected when at least one of its env vars is present.
const haveFirebaseEnv = firebaseKeys.some(k => process.env[k]);
const haveStripeEnv   = stripeKeys.some(k => process.env[k]);

let firebaseConfig = null;
if (haveFirebaseEnv) {
  firebaseConfig = JSON.stringify({
    apiKey:            process.env.FIREBASE_API_KEY            || '',
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || '',
    projectId:         process.env.FIREBASE_PROJECT_ID         || '',
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID|| '',
    appId:             process.env.FIREBASE_APP_ID             || '',
  });
}

let stripeConfig = null;
if (haveStripeEnv) {
  stripeConfig = JSON.stringify({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY       || '',
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY      || '',
    priceIdYearly:  process.env.STRIPE_PRICE_ID_YEARLY       || '',
    portalUrl:      process.env.STRIPE_CUSTOMER_PORTAL_URL   || '',
  });
}

if (!haveFirebaseEnv && !haveStripeEnv) {
  console.log('[inject-config] No config env vars set — leaving committed meta values intact (no-op).');
}

// ── Find all HTML files in public/ ───────────────────────────
function findHTML(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findHTML(full));
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

const publicDir = path.resolve(__dirname, '..', 'public');
const htmlFiles = findHTML(publicDir);

// ── Inject config into each HTML file (only groups with env) ──
let injected = 0;
for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  if (firebaseConfig !== null) {
    content = content.replace(
      /(<meta name="firebase-config" content=')[^']*(')/g,
      `$1${firebaseConfig.replace(/'/g, '&apos;')}$2`
    );
  }

  if (stripeConfig !== null) {
    content = content.replace(
      /(<meta name="stripe-config" content=')[^']*(')/g,
      `$1${stripeConfig.replace(/'/g, '&apos;')}$2`
    );
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    injected++;
    console.log(`[inject-config] ✓ ${path.relative(publicDir, file)}`);
  }
}

console.log(`[inject-config] Done — ${injected}/${htmlFiles.length} HTML files updated.`);
