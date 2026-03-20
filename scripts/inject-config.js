#!/usr/bin/env node
// scripts/inject-config.js
// Replaces REPLACE_WITH_* placeholder values in all HTML files
// with actual environment variable values at build time.
//
// Usage:
//   node scripts/inject-config.js
//   (Vercel runs this automatically via the "build" script in package.json)
//
// Required environment variables (set in Vercel project settings):
//   FIREBASE_API_KEY
//   FIREBASE_AUTH_DOMAIN
//   FIREBASE_PROJECT_ID
//   FIREBASE_STORAGE_BUCKET
//   FIREBASE_MESSAGING_SENDER_ID
//   FIREBASE_APP_ID
//   STRIPE_PUBLISHABLE_KEY
//   STRIPE_PRICE_ID_MONTHLY
//   STRIPE_PRICE_ID_YEARLY
//   STRIPE_CUSTOMER_PORTAL_URL

const fs   = require('fs');
const path = require('path');
const glob = require('glob'); // node built-in via fs.readdirSync recursion below

// ── Collect env vars ──────────────────────────────────────────
const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_PRICE_ID_YEARLY',
  'STRIPE_CUSTOMER_PORTAL_URL',
];

const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.warn(`[inject-config] WARNING: missing env vars: ${missing.join(', ')}`);
  console.warn('[inject-config] Placeholders will remain in output HTML — set vars in Vercel project settings.');
}

// Build the firebase-config and stripe-config JSON strings
const firebaseConfig = JSON.stringify({
  apiKey:            process.env.FIREBASE_API_KEY            || 'REPLACE_WITH_API_KEY',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || 'REPLACE.firebaseapp.com',
  projectId:         process.env.FIREBASE_PROJECT_ID         || 'REPLACE_WITH_PROJECT_ID',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || 'REPLACE.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID|| 'REPLACE',
  appId:             process.env.FIREBASE_APP_ID             || 'REPLACE_WITH_APP_ID',
});

const stripeConfig = JSON.stringify({
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY       || 'REPLACE_WITH_STRIPE_PUBLISHABLE_KEY',
  priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY      || 'REPLACE_WITH_STRIPE_PRICE_ID_MONTHLY',
  priceIdYearly:  process.env.STRIPE_PRICE_ID_YEARLY       || 'REPLACE_WITH_STRIPE_PRICE_ID_YEARLY',
  portalUrl:      process.env.STRIPE_CUSTOMER_PORTAL_URL   || 'https://billing.stripe.com/p/login/REPLACE',
});

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

// ── Inject config into each HTML file ────────────────────────
let injected = 0;
for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Replace firebase-config meta tag content
  content = content.replace(
    /(<meta name="firebase-config" content=')[^']*(')/g,
    `$1${firebaseConfig.replace(/'/g, '&apos;')}$2`
  );

  // Replace stripe-config meta tag content
  content = content.replace(
    /(<meta name="stripe-config" content=')[^']*(')/g,
    `$1${stripeConfig.replace(/'/g, '&apos;')}$2`
  );

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    injected++;
    console.log(`[inject-config] ✓ ${path.relative(publicDir, file)}`);
  }
}

console.log(`[inject-config] Done — ${injected}/${htmlFiles.length} HTML files updated.`);
