// js/app.js — mdothree-timestamp (Firebase-integrated)

import { unixToFormats, dateToFormats }    from './services/timestampConverter.js';
import { copyToClipboard, showToast }      from './utils/dateUtils.js';
import {
  logConversion,
  loadConversionHistory,
  deleteConversionEntry,
} from './services/conversionStorage.js';
import { onAuthChange, ensureAnonymousUser } from './config/config.js';
import { initSubscription, onSubscriptionChange } from './services/subscriptionService.js';
import { proGate, proBadge, handleStripeReturn } from './services/paywallUI.js';
import { firebaseConfig } from './config/firebase.js';
initSubscription();
handleStripeReturn();
onSubscriptionChange(status => {
  const nav = document.querySelector('.tool-nav');
  if (!nav) return;
  const existing = nav.querySelector('.pro-badge');
  if (status.isPro && !existing) nav.appendChild(proBadge());
  else if (!status.isPro && existing) existing.remove();
});

// ---- Auth badge ----
const authBadge = Object.assign(document.createElement('div'), {
  style: 'position:fixed;bottom:16px;right:16px;font-size:0.72rem;color:var(--text-secondary);font-family:var(--font-mono);z-index:999',
});
document.body.appendChild(authBadge);
onAuthChange(u => { authBadge.textContent = u ? '🔥 syncing' : '☁ offline'; });
ensureAnonymousUser().then(() => loadAndRenderHistory());

// ---- Live timestamp ----
const liveTs   = document.getElementById('liveTs');
const liveDate = document.getElementById('liveDate');

function updateLive() {
  const now = Math.floor(Date.now() / 1000);
  if (liveTs)   liveTs.textContent   = now;
  if (liveDate) liveDate.textContent = new Date().toUTCString();
}
updateLive();
setInterval(updateLive, 1000);

document.getElementById('copyLiveTs')?.addEventListener('click', async () => {
  await copyToClipboard(liveTs.textContent);
  showToast('Copied!');
});

// ---- Timestamp -> Date ----
document.getElementById('tsToDate')?.addEventListener('click', async () => {
  const val  = document.getElementById('tsInput').value.trim();
  const unit = document.getElementById('tsUnit').value;
  if (!val) return;
  try {
    const formats = unixToFormats(parseFloat(val), unit);
    renderFormats('tsDateRows', 'tsDateOutput', formats);
    const summary = 'Unix ' + val + ' -> ' + formats['Local'];
    await logConversion({ type: 'unix', input: val, outputs: formats, summary });
    await loadAndRenderHistory();
  } catch (e) { showToast('Error: ' + e.message); }
});

// ---- Date -> Timestamp ----
const dateInput = document.getElementById('dateInput');
if (dateInput) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.value = now.toISOString().slice(0, 16);
}

document.getElementById('dateToTs')?.addEventListener('click', async () => {
  const val = document.getElementById('dateInput').value;
  if (!val) return;
  try {
    const formats = dateToFormats(val);
    renderFormats('dateRows', 'dateOutput', formats);
    const summary = val + ' -> ' + formats['Unix (seconds)'];
    await logConversion({ type: 'date', input: val, outputs: formats, summary });
    await loadAndRenderHistory();
  } catch (e) { showToast('Error: ' + e.message); }
});

// ---- Render format rows ----
function renderFormats(rowsId, panelId, formats) {
  const panel = document.getElementById(panelId);
  const rows  = document.getElementById(rowsId);
  if (!panel || !rows) return;
  rows.innerHTML = '';
  panel.style.display = 'block';
  Object.entries(formats).forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'output-row';
    row.innerHTML =
      '<span class="output-row-label">' + label + '</span>' +
      '<span class="output-row-value" title="Click to copy">' + value + '</span>';
    row.querySelector('.output-row-value').addEventListener('click', async () => {
      await copyToClipboard(value); showToast(label + ' copied!');
    });
    rows.appendChild(row);
  });
}

// ---- Firebase history panel ----
function ensureHistoryPanel() {
  if (document.getElementById('conversionHistoryPanel')) return;
  const main = document.querySelector('.tool-body');
  if (!main) return;
  const panel = document.createElement('div');
  panel.id = 'conversionHistoryPanel';
  panel.className = 'output-panel';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<label class="field-label" style="margin:0">Recent Conversions</label>' +
      '<button id="clearConvHistory" class="btn-ghost" style="font-size:0.75rem;padding:4px 10px">Clear</button>' +
    '</div>' +
    '<div id="convHistoryList" style="display:flex;flex-direction:column;gap:6px"></div>';
  main.appendChild(panel);
  document.getElementById('clearConvHistory')?.addEventListener('click', async () => {
    const items = await loadConversionHistory(50);
    await Promise.all(items.map(i => deleteConversionEntry(i.id)));
    await loadAndRenderHistory();
    showToast('History cleared');
  });
}

async function loadAndRenderHistory() {
  ensureHistoryPanel();
  const list = document.getElementById('convHistoryList');
  if (!list) return;
  const items = await loadConversionHistory(10);
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-secondary)">No conversions yet.</div>';
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.8rem';
    row.innerHTML =
      '<span style="flex:1;font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + item.summary + '">' + item.summary + '</span>' +
      '<span style="color:var(--text-secondary);white-space:nowrap">' + item.createdAt.toLocaleTimeString() + '</span>' +
      '<button data-id="' + item.id + '" class="del-conv-btn" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:0 4px" title="Remove">x</button>';
    row.querySelector('.del-conv-btn').addEventListener('click', async e => {
      e.stopPropagation();
      await deleteConversionEntry(item.id);
      await loadAndRenderHistory();
    });
    list.appendChild(row);
  });
}
