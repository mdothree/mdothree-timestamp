// js/app.js — mdothree-timestamp (Firebase-integrated)

import { unixToFormats, dateToFormats, detectUnit, UNIT_NAMES } from './services/timestampConverter.js';
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
onAuthChange(u => { authBadge.textContent = u ? '● signed in' : '○ offline'; });
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
  showToast((await copyToClipboard(liveTs.textContent)) ? 'Copied!' : 'Copy failed');
});

// ---- Timestamp -> Date ----
async function convertTs() {
  const val    = document.getElementById('tsInput').value.trim();
  const unitEl = document.getElementById('tsUnit');
  const notice = document.getElementById('tsUnitNotice');
  if (!val) return;
  // Auto-detect s / ms / µs / ns by digit count (e.g. a 13-digit Date.now() value is ms).
  const detected = detectUnit(val);
  let unit = unitEl.value;
  if (notice) notice.hidden = true;
  if (detected && detected !== unit) {
    unit = detected;
    if ([...unitEl.options].some(o => o.value === detected)) unitEl.value = detected;
    if (notice) {
      notice.textContent = `Interpreted as ${UNIT_NAMES[detected]} (${val.replace(/^-/, '').split('.')[0].length} digits).`;
      notice.hidden = false;
    }
  }
  let formats;
  try {
    formats = unixToFormats(parseFloat(val), unit);
    renderFormats('tsDateRows', 'tsDateOutput', formats);
  } catch (e) { showToast('Error: ' + e.message); return; }
  // History logging is best-effort and must not report an error for a successful conversion.
  try {
    const summary = 'Unix ' + val + ' -> ' + formats['Local'];
    await logConversion({ type: 'unix', input: val, outputs: formats, summary });
    await loadAndRenderHistory();
  } catch (e) { console.warn('[timestamp] history save failed', e); }
}
document.getElementById('tsToDate')?.addEventListener('click', convertTs);
document.getElementById('tsInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') convertTs(); });

// ---- Date -> Timestamp ----
const dateInput = document.getElementById('dateInput');
if (dateInput) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.value = now.toISOString().slice(0, 16);
}

async function convertDate() {
  const val = document.getElementById('dateInput').value;
  if (!val) return;
  let formats;
  try {
    formats = dateToFormats(val);
    renderFormats('dateRows', 'dateOutput', formats);
  } catch (e) { showToast('Error: ' + e.message); return; }
  try {
    const summary = val + ' -> ' + formats['Unix (seconds)'];
    await logConversion({ type: 'date', input: val, outputs: formats, summary });
    await loadAndRenderHistory();
  } catch (e) { console.warn('[timestamp] history save failed', e); }
}
document.getElementById('dateToTs')?.addEventListener('click', convertDate);
document.getElementById('dateInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') convertDate(); });

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
    const lab = document.createElement('span');
    lab.className = 'output-row-label';
    lab.textContent = label;
    const val = document.createElement('span');
    val.className = 'output-row-value';
    val.title = 'Click to copy';
    val.textContent = value;
    row.append(lab, val);
    row.querySelector('.output-row-value').addEventListener('click', async () => {
      showToast((await copyToClipboard(value)) ? label + ' copied!' : 'Copy failed');
    });
    rows.appendChild(row);
  });
}

// ---- Local history panel (localStorage only; never uploaded) ----
function ensureHistoryPanel() {
  if (document.getElementById('conversionHistoryPanel')) return;
  const main = document.querySelector('.tool-body');
  if (!main) return;
  const panel = document.createElement('div');
  panel.id = 'conversionHistoryPanel';
  panel.className = 'output-panel';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<label class="field-label" style="margin:0">Recent Conversions <span style="font-weight:400;opacity:.7">(this browser only)</span></label>' +
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
    // Built with textContent: summary contains raw user input and must never be parsed as HTML.
    row.innerHTML =
      '<span style="flex:1;font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>' +
      '<span style="color:var(--text-secondary);white-space:nowrap"></span>' +
      '<button class="del-conv-btn" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:0 4px" title="Remove">x</button>';
    const [sumEl, timeEl] = row.querySelectorAll('span');
    sumEl.textContent = sumEl.title = String(item.summary ?? '');
    timeEl.textContent = item.createdAt?.toLocaleTimeString?.() ?? '';
    row.querySelector('.del-conv-btn').addEventListener('click', async e => {
      e.stopPropagation();
      await deleteConversionEntry(item.id);
      await loadAndRenderHistory();
    });
    list.appendChild(row);
  });
}
