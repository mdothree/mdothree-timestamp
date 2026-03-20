// js/pages/cron-parser.js — Cron Expression Parser (Pro)
import { parseCron, CRON_EXAMPLES } from '../services/cronParser.js';
import { withLoading, showToast as uiToast, showError } from '../utils/ui-helpers.js';
import { initSubscription }          from '../services/subscriptionService.js';
import { proGate, lockElement, handleStripeReturn } from '../services/paywallUI.js';
import { ensureAnonymousUser }        from '../config/config.js';

initSubscription();
handleStripeReturn();
ensureAnonymousUser();

(async () => {
  const allowed = await proGate('timestamp.cron');
  if (!allowed) {
    const body = document.querySelector('.tool-body');
    if (body) lockElement(body, 'timestamp.cron', 'Cron Expression Parser');
    return;
  }
  initPage();
})();

const FIELD_LABELS = ['Minute', 'Hour', 'Day', 'Month', 'Weekday'];

function renderParts(expr) {
  const parts     = expr.trim().split(/\s+/);
  const container = document.getElementById('cronParts');
  container.innerHTML = '';
  (parts.length === 5 ? parts : ['*', '*', '*', '*', '*']).forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'cron-part';
    el.innerHTML = `
      <div class="cron-part-label">${FIELD_LABELS[i]}</div>
      <div class="cron-part-value">${p}</div>
    `;
    container.appendChild(el);
  });
}

function parse() {
  const expr    = document.getElementById('cronInput').value;
  renderParts(expr);

  const result  = parseCron(expr);
  const panel   = document.getElementById('cronResult');
  panel.hidden  = false;

  const expEl   = document.getElementById('cronExplanation');
  expEl.textContent = result.explanation;
  expEl.className   = result.valid ? 'cron-explanation' : 'cron-explanation cron-explanation--error';

  const nextRuns = document.getElementById('nextRuns');
  nextRuns.innerHTML = '';
  result.nextRuns.forEach(d => {
    const el = document.createElement('div');
    el.className = 'next-run-item';
    el.textContent = d.toLocaleString();
    nextRuns.appendChild(el);
  });
}

function initPage() {
  document.getElementById('parseCronBtn').addEventListener('click', withLoading(document.getElementById('parseCronBtn'), 'Parsing…', async () => parse()));
  document.getElementById('cronInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') parse();
  });

  // Populate examples
  const exCont = document.getElementById('examples');
  CRON_EXAMPLES.forEach(({ expr, label }) => {
    const btn = document.createElement('button');
    btn.className = 'cron-example-btn btn-ghost';
    btn.innerHTML = `<code class="cron-code">${expr}</code> — ${label}`;
    btn.addEventListener('click', () => {
      document.getElementById('cronInput').value = expr;
      parse();
    });
    exCont.appendChild(btn);
  });

  renderParts('0 9 * * 1-5');
  parse();
}

// Global error boundary — catch unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('[mdothree] Unhandled promise rejection:', event.reason);
  uiToast(event.reason?.message || 'An unexpected error occurred', 'error');
  event.preventDefault();
});
