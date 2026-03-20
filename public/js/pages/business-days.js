// js/pages/business-days.js — Business Days Calculator (Pro)
import { countBusinessDays, addBusinessDays, showToast } from '../utils/dateUtils.js';
import { withLoading, showToast as uiToast, showError } from '../utils/ui-helpers.js';
import { initSubscription }                               from '../services/subscriptionService.js';
import { proGate, lockElement, handleStripeReturn }       from '../services/paywallUI.js';
import { ensureAnonymousUser }                            from '../config/config.js';

initSubscription();
handleStripeReturn();
ensureAnonymousUser();

(async () => {
  const allowed = await proGate('timestamp.business');
  if (!allowed) {
    const body = document.querySelector('.tool-body');
    if (body) lockElement(body, 'timestamp.business', 'Business Days Calculator');
    return;
  }
  initPage();
})();

function initPage() {
  const today = new Date().toISOString().split('T')[0];
  const month = new Date(Date.now() + 30 * 24 * 3600000).toISOString().split('T')[0];

  document.getElementById('bdStart').value    = today;
  document.getElementById('bdAddStart').value = today;
  document.getElementById('bdEnd').value      = month;

  // Count business days
  document.getElementById('countBd').addEventListener('click', () => {
    const start = new Date(document.getElementById('bdStart').value);
    const end   = new Date(document.getElementById('bdEnd').value);
    if (isNaN(start) || isNaN(end)) return;

    const count  = countBusinessDays(start, end);
    const result = document.getElementById('bdCountResult');
    result.hidden = false;
    document.getElementById('bdCount').textContent = count.toLocaleString();
  });

  // Add business days
  document.getElementById('addBdBtn').addEventListener('click', () => {
    const start = new Date(document.getElementById('bdAddStart').value);
    const count = parseInt(document.getElementById('bdAddCount').value) || 30;
    if (isNaN(start)) return;

    const result = addBusinessDays(start, count);
    document.getElementById('bdAddResult').hidden = false;
    document.getElementById('bdAddVal').textContent =
      result.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
      ' (' + result.toISOString().split('T')[0] + ')';
  });
}

// Global error boundary — catch unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('[mdothree] Unhandled promise rejection:', event.reason);
  uiToast(event.reason?.message || 'An unexpected error occurred', 'error');
  event.preventDefault();
});
