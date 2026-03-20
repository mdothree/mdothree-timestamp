// utils/inline-modal.js
// Non-blocking replacement for the browser's synchronous prompt() dialog.
// Returns a Promise that resolves with the entered string, or null if cancelled.
//
// Usage:
//   import { promptModal } from '../utils/inline-modal.js';
//   const name = await promptModal('Palette name:', 'Triadic palette');
//   if (name === null) return; // user cancelled

let _styleInjected = false;

function injectStyles() {
  if (_styleInjected || typeof document === 'undefined') return;
  _styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .pm-overlay {
      position: fixed; inset: 0; z-index: 10001;
      background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; animation: pm-in 150ms ease;
    }
    @keyframes pm-in { from { opacity:0 } to { opacity:1 } }

    .pm-box {
      background: #fff; border-radius: 14px; padding: 24px 24px 20px;
      width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      animation: pm-up 160ms cubic-bezier(0.34,1.56,0.64,1);
      font-family: 'DM Sans', system-ui, sans-serif;
    }
    @keyframes pm-up { from { transform:translateY(12px);opacity:0 } to { transform:translateY(0);opacity:1 } }

    .pm-label {
      font-size: 0.875rem; font-weight: 600; color: #0F172A;
      margin-bottom: 10px; display: block;
    }
    .pm-input {
      width: 100%; padding: 10px 12px;
      border: 1.5px solid #CBD5E1; border-radius: 8px;
      font-family: inherit; font-size: 0.9rem; color: #0F172A;
      outline: none; transition: border-color 150ms;
      box-sizing: border-box;
    }
    .pm-input:focus { border-color: #10B981; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); }

    .pm-actions {
      display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;
    }
    .pm-btn {
      padding: 8px 18px; border-radius: 8px; font-family: inherit;
      font-size: 0.875rem; font-weight: 600; cursor: pointer;
      border: none; transition: background 150ms;
    }
    .pm-btn-cancel {
      background: #F1F5F9; color: #64748B;
    }
    .pm-btn-cancel:hover { background: #E2E8F0; }
    .pm-btn-confirm {
      background: #10B981; color: #fff;
    }
    .pm-btn-confirm:hover { background: #059669; }
  `;
  document.head.appendChild(style);
}

/**
 * Show a non-blocking input prompt modal.
 *
 * @param {string} label        — Question/label text shown above the input
 * @param {string} [defaultVal] — Pre-filled value in the input
 * @param {string} [confirmText] — Confirm button label (default: 'OK')
 * @returns {Promise<string|null>} Entered string, or null if cancelled/dismissed
 */
export function promptModal(label, defaultVal = '', confirmText = 'OK') {
  injectStyles();

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'pm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', label);

    overlay.innerHTML = `
      <div class="pm-box">
        <label class="pm-label" for="pm-input-field">${label}</label>
        <input
          id="pm-input-field"
          class="pm-input"
          type="text"
          value="${defaultVal.replace(/"/g, '&quot;')}"
          autocomplete="off"
          spellcheck="false"
        />
        <div class="pm-actions">
          <button class="pm-btn pm-btn-cancel" id="pm-cancel">Cancel</button>
          <button class="pm-btn pm-btn-confirm" id="pm-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.querySelector('#pm-confirm').addEventListener('click', () => {
      close(overlay.querySelector('#pm-input-field').value);
    });

    overlay.querySelector('#pm-cancel').addEventListener('click', () => close(null));

    // Close on backdrop click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close(null);
    });

    // Keyboard: Enter = confirm, Escape = cancel
    overlay.querySelector('#pm-input-field').addEventListener('keydown', e => {
      if (e.key === 'Enter')  close(overlay.querySelector('#pm-input-field').value);
      if (e.key === 'Escape') close(null);
    });

    document.body.appendChild(overlay);

    // Focus the input after mount
    requestAnimationFrame(() => {
      const input = overlay.querySelector('#pm-input-field');
      input.focus();
      input.select();
    });
  });
}
