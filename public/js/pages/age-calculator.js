// js/pages/age-calculator.js — Age Calculator page logic
import { calcDuration, formatDuration } from '../services/durationCalculator.js';
import { withLoading, showToast as uiToast, showError } from '../utils/ui-helpers.js';
import { showToast }                    from '../utils/dateUtils.js';
import { initSubscription }             from '../services/subscriptionService.js';
import { proBadge, handleStripeReturn } from '../services/paywallUI.js';
import { onAuthChange }                 from '../config/config.js';

initSubscription();
handleStripeReturn();
onAuthChange(u => {
  const nav = document.querySelector('.tool-nav');
  if (!nav) return;
  if (u && !nav.querySelector('.pro-badge')) nav.appendChild(proBadge());
});

const today = new Date().toISOString().split('T')[0];
document.getElementById('ageAsOf').value = today;

document.getElementById('calcAge').addEventListener('click', () => {
  const birth = document.getElementById('birthDate').value;
  const asOf  = document.getElementById('ageAsOf').value || today;
  if (!birth) return;

  try {
    const dur  = calcDuration(birth, asOf);
    const panel = document.getElementById('ageResult');
    panel.hidden = false;

    document.getElementById('ageMain').textContent =
      `${dur.years} years, ${dur.months} months, ${dur.days} days`;

    const rows = document.getElementById('ageRows');
    rows.innerHTML = '';

    [
      ['In months',  (dur.years * 12 + dur.months).toLocaleString()],
      ['In weeks',   Math.floor(dur.totalDays / 7).toLocaleString()],
      ['In days',    dur.totalDays.toLocaleString()],
      ['In hours',   dur.totalHours.toLocaleString()],
      ['In minutes', dur.totalMinutes.toLocaleString()],
      ['In seconds', dur.totalSeconds.toLocaleString()],
    ].forEach(([label, val]) => {
      const row = document.createElement('div');
      row.className = 'output-row';
      row.innerHTML = `<span class="output-row-label">${label}</span><span class="output-row-value">${val}</span>`;
      rows.appendChild(row);
    });
  } catch (e) {
    showToast('Error: ' + e.message);
  }
});

// Global error boundary — catch unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('[mdothree] Unhandled promise rejection:', event.reason);
  uiToast(event.reason?.message || 'An unexpected error occurred', 'error');
  event.preventDefault();
});
