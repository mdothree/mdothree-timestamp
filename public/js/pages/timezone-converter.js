// js/pages/timezone-converter.js
import { COMMON_TIMEZONES, formatInTimezone, getUTCOffset, convertTimezone, getCurrentInTimezones } from '../services/timezoneService.js';
import { withLoading, showToast as uiToast, showError } from '../utils/ui-helpers.js';
import { showToast, copyToClipboard } from '../utils/dateUtils.js';
import { saveTimezonePreset, loadTimezonePresets, deleteTimezonePreset } from '../services/conversionStorage.js';
import { initSubscription, onSubscriptionChange } from '../services/subscriptionService.js';
import { proGate, proBadge, handleStripeReturn } from '../services/paywallUI.js';
import { onAuthChange, ensureAnonymousUser } from '../config/config.js';
import { promptModal }                      from '../utils/inline-modal.js';

initSubscription();
handleStripeReturn();
ensureAnonymousUser().then(loadPresets);

// Pro badge only for a real Pro entitlement (anonymous sign-in is not Pro).
onSubscriptionChange(status => {
  const nav = document.querySelector('.tool-nav');
  if (!nav) return;
  const existing = nav.querySelector('.pro-badge');
  if (status.isPro && !existing) nav.appendChild(proBadge());
  else if (!status.isPro && existing) existing.remove();
});

// ---- Populate timezone selects ----
const fromTzEl = document.getElementById('fromTz');
const toTzEl   = document.getElementById('toTz');

// Make sure the browser's own zone is selectable even if it is not in the short list.
const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const tzList = COMMON_TIMEZONES.includes(browserTz) ? COMMON_TIMEZONES : [browserTz, ...COMMON_TIMEZONES];

tzList.forEach(tz => {
  [fromTzEl, toTzEl].forEach(sel => {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz;
    sel.appendChild(opt);
  });
});

fromTzEl.value = browserTz;
toTzEl.value   = 'UTC';

// ---- Default datetime-local ----
const dtInput = document.getElementById('dtInput');
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
dtInput.value = now.toISOString().slice(0, 16);

// ---- Swap ----
document.getElementById('swapTz').addEventListener('click', () => {
  const a = fromTzEl.value;
  fromTzEl.value = toTzEl.value;
  toTzEl.value   = a;
});

// ---- Convert ----
document.getElementById('convertTz').addEventListener('click', withLoading(document.getElementById('convertTz'), 'Converting…', async () => {
  const dt     = dtInput.value;
  const fromTz = fromTzEl.value;
  const toTz   = toTzEl.value;
  try {
    const result = convertTimezone(dt, fromTz, toTz);
    const panel  = document.getElementById('tzResult');
    const rows   = document.getElementById('tzRows');
    rows.innerHTML = '';
    panel.hidden   = false;

    [
      ['Converted time', result.formatted],
      ['ISO 8601',       result.iso],
      ['Offset',         result.offset],
    ].forEach(([label, val]) => {
      const row = document.createElement('div');
      row.className = 'output-row';
      row.innerHTML = `<span class="output-row-label">${label}</span><span class="output-row-value">${val}</span>`;
      row.querySelector('.output-row-value').addEventListener('click', async () => {
        showToast((await copyToClipboard(val)) ? 'Copied!' : 'Copy failed');
      });
      rows.appendChild(row);
    });
  } catch (e) {
    showToast('Error: ' + e.message);
  }
}));

// ---- Save preset (Pro) ----
document.getElementById('savePresetBtn').addEventListener('click', async () => {
  if (!await proGate('timestamp.presets')) return;
  const from = fromTzEl.value;
  const to   = toTzEl.value;
  const name = await promptModal('Preset name:', `${from} → ${to}`);
  if (name === null) return;  // user cancelled
  await saveTimezonePreset({ name: name || `${from} → ${to}`, fromTz: from, toTz: to });
  await loadPresets();
  showToast('Preset saved!');
});

async function loadPresets() {
  const container = document.getElementById('tzPresets');
  if (!container) return;
  const presets = await loadTimezonePresets();
  container.innerHTML = '';

  if (!presets.length) {
    container.innerHTML = '<p class="empty-state">No saved presets yet.</p>';
    return;
  }

  presets.forEach(p => {
    const row = document.createElement('div');
    row.className = 'preset-row';
    row.innerHTML = `
      <span class="preset-name">${p.name}</span>
      <button class="btn-ghost btn-xs load-preset-btn">Load</button>
      <button class="del-btn" data-id="${p.id}" aria-label="Delete preset">✕</button>
    `;
    row.querySelector('.load-preset-btn').addEventListener('click', () => {
      fromTzEl.value = p.fromTz;
      toTzEl.value   = p.toTz;
    });
    row.querySelector('.del-btn').addEventListener('click', async () => {
      await deleteTimezonePreset(p.id);
      await loadPresets();
    });
    container.appendChild(row);
  });
}

// ---- World clocks ----
const POPULAR_ZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney',
];

function updateWorldClocks() {
  const container = document.getElementById('worldClocks');
  if (!container) return;
  const clocks = getCurrentInTimezones(POPULAR_ZONES);
  container.innerHTML = '';
  clocks.forEach(({ tz, time, offset }) => {
    const card = document.createElement('div');
    card.className = 'world-clock-card';
    card.innerHTML = `
      <div class="world-clock-name">${tz.split('/').pop().replace(/_/g, ' ')}</div>
      <div class="world-clock-time">${time}</div>
      <div class="world-clock-offset">${offset}</div>
    `;
    container.appendChild(card);
  });
}

updateWorldClocks();
setInterval(updateWorldClocks, 1000);

// Global error boundary — catch unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('[mdothree] Unhandled promise rejection:', event.reason);
  uiToast(event.reason?.message || 'An unexpected error occurred', 'error');
  event.preventDefault();
});
