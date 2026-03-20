// js/pages/duration-calculator.js — Duration Calculator page logic
import { calcDuration, addDuration, formatDuration } from '../services/durationCalculator.js';
import { withLoading, showToast as uiToast, showError } from '../utils/ui-helpers.js';
import { showToast, copyToClipboard }                from '../utils/dateUtils.js';
import { initSubscription }                          from '../services/subscriptionService.js';
import { proBadge, handleStripeReturn }              from '../services/paywallUI.js';
import { onAuthChange }                              from '../config/config.js';

initSubscription();
handleStripeReturn();
onAuthChange(u => {
  const nav = document.querySelector('.tool-nav');
  if (!nav) return;
  if (u && !nav.querySelector('.pro-badge')) nav.appendChild(proBadge());
});

// ---- Default dates ----
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const nowStr = now.toISOString().slice(0, 16);

const future = new Date(now.getTime() + 90 * 24 * 3600000);
future.setMinutes(future.getMinutes() - future.getTimezoneOffset());

document.getElementById('durStart').value = nowStr;
document.getElementById('addBase').value  = nowStr;
document.getElementById('durEnd').value   = future.toISOString().slice(0, 16);

// ---- Calculate duration ----
document.getElementById('calcDur').addEventListener('click', () => {
  try {
    const dur   = calcDuration(document.getElementById('durStart').value, document.getElementById('durEnd').value);
    const panel = document.getElementById('durResult');
    const rows  = document.getElementById('durRows');
    rows.innerHTML = '';
    panel.hidden   = false;

    const pairs = [
      ['Human readable',       formatDuration(dur)],
      ['Total days',           dur.totalDays.toLocaleString()],
      ['Total hours',          dur.totalHours.toLocaleString()],
      ['Total minutes',        dur.totalMinutes.toLocaleString()],
      ['Total seconds',        dur.totalSeconds.toLocaleString()],
      ['Total milliseconds',   dur.totalMs.toLocaleString()],
    ];

    pairs.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'output-row';
      row.innerHTML = `<span class="output-row-label">${label}</span><span class="output-row-value">${value}</span>`;
      row.querySelector('.output-row-value').addEventListener('click', async () => {
        await copyToClipboard(value);
        showToast('Copied!');
      });
      rows.appendChild(row);
    });
  } catch (e) {
    showToast('Error: ' + e.message);
  }
});

// ---- Add / subtract ----
function doAdd(op) {
  try {
    const base  = document.getElementById('addBase').value;
    const delta = {
      years:   +document.getElementById('addYears').value   || 0,
      months:  +document.getElementById('addMonths').value  || 0,
      days:    +document.getElementById('addDays').value    || 0,
      hours:   +document.getElementById('addHours').value   || 0,
      minutes: +document.getElementById('addMinutes').value || 0,
      seconds: +document.getElementById('addSeconds').value || 0,
    };
    const result = addDuration(base, delta, op);
    const panel  = document.getElementById('addResult');
    panel.hidden = false;

    const el = document.getElementById('addResultVal');
    el.textContent = result.toLocaleString() + ' — ' + result.toISOString();
    el.addEventListener('click', async () => {
      await copyToClipboard(result.toISOString());
      showToast('ISO date copied!');
    });
  } catch (e) {
    showToast('Error: ' + e.message);
  }
}

document.getElementById('addBtn').addEventListener('click', () => doAdd('add'));
document.getElementById('subBtn').addEventListener('click', () => doAdd('subtract'));

// Global error boundary — catch unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('[mdothree] Unhandled promise rejection:', event.reason);
  uiToast(event.reason?.message || 'An unexpected error occurred', 'error');
  event.preventDefault();
});
