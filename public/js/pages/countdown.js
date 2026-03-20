// js/pages/countdown.js — Countdown Timer page logic
import { startCountdown } from '../services/countdownTimer.js';
import { withLoading, showToast as uiToast, showError } from '../utils/ui-helpers.js';
import { initSubscription } from '../services/subscriptionService.js';
import { proBadge, handleStripeReturn } from '../services/paywallUI.js';
import { onAuthChange } from '../config/config.js';

initSubscription();
handleStripeReturn();
onAuthChange(u => {
  const nav = document.querySelector('.tool-nav');
  if (!nav) return;
  if (u && !nav.querySelector('.pro-badge')) nav.appendChild(proBadge());
});

let stopFn = null;

// Default: next New Year
const nextNY = new Date(new Date().getFullYear() + 1, 0, 1);
nextNY.setMinutes(nextNY.getMinutes() - nextNY.getTimezoneOffset());

const cdTargetEl = document.getElementById('cdTarget');
const cdLabelEl  = document.getElementById('cdLabel');
cdTargetEl.value = nextNY.toISOString().slice(0, 16);
cdLabelEl.value  = `New Year ${new Date().getFullYear() + 1}`;

document.getElementById('startCd').addEventListener('click', startTimer);
document.getElementById('stopCd').addEventListener('click', () => {
  if (stopFn) { stopFn(); stopFn = null; }
  document.getElementById('stopCd').hidden = true;
});

function startTimer() {
  if (stopFn) stopFn();

  const target = cdTargetEl.value;
  if (!target) return;

  document.getElementById('cdPanel').hidden   = false;
  document.getElementById('stopCd').hidden    = false;
  document.getElementById('cdTitle').textContent = cdLabelEl.value || new Date(target).toLocaleString();

  stopFn = startCountdown(target, ({ days, hours, minutes, seconds, isPast }) => {
    document.getElementById('cdDays').textContent    = days;
    document.getElementById('cdHours').textContent   = String(hours).padStart(2, '0');
    document.getElementById('cdMinutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('cdSeconds').textContent = String(seconds).padStart(2, '0');
    document.getElementById('cdStatus').textContent  = isPast ? '(this event has passed)' : '';
  });
}

// Auto-start on load
startTimer();

// Global error boundary — catch unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('[mdothree] Unhandled promise rejection:', event.reason);
  uiToast(event.reason?.message || 'An unexpected error occurred', 'error');
  event.preventDefault();
});
