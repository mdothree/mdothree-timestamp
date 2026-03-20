// shared/ui-helpers.js
// Reusable UI utilities: button loading states, error display, toast notifications.
// Imported by all page JS files.

/**
 * Put a button into a loading state and return a restore function.
 * @param {HTMLButtonElement} btn
 * @param {string} [loadingText]
 * @returns {() => void} call to restore the button
 */
export function setLoading(btn, loadingText = 'Loading…') {
  if (!btn) return () => {};
  const original = btn.textContent;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.textContent = loadingText;
  btn.dataset.loading = '1';
  return () => {
    btn.disabled = wasDisabled;
    btn.textContent = original;
    delete btn.dataset.loading;
  };
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type]
 * @param {number} [duration]
 */
export function showToast(message, type = 'info', duration = 2500) {
  let toast = document.getElementById('__mdothree_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__mdothree_toast';
    Object.assign(toast.style, {
      position:       'fixed',
      bottom:         '24px',
      left:           '50%',
      transform:      'translateX(-50%) translateY(20px)',
      background:     '#1E293B',
      color:          '#fff',
      padding:        '10px 20px',
      borderRadius:   '8px',
      fontSize:       '0.875rem',
      fontFamily:     'DM Sans, sans-serif',
      fontWeight:     '500',
      opacity:        '0',
      pointerEvents:  'none',
      transition:     'opacity 200ms, transform 200ms',
      zIndex:         '99999',
      maxWidth:       '90vw',
      textAlign:      'center',
    });
    document.body.appendChild(toast);
  }

  const colors = { info: '#1E293B', success: '#059669', error: '#DC2626' };
  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

/**
 * Show an inline error message below a container element.
 * @param {string|null} message  — null clears the error
 * @param {HTMLElement} container — element to append error below
 * @param {string} [id]           — unique id to prevent duplicates
 */
export function showError(message, container, id = '__mdothree_err') {
  let el = document.getElementById(id);
  if (!message) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'alert');
    Object.assign(el.style, {
      color:      '#DC2626',
      fontSize:   '0.82rem',
      marginTop:  '6px',
      fontFamily: 'DM Sans, sans-serif',
    });
    container?.after(el);
  }
  el.textContent = message;
}

/**
 * Wrap an async event handler with automatic error catching and loading state.
 * Usage: btn.addEventListener('click', withLoading(btn, 'Saving…', async () => { ... }))
 *
 * @param {HTMLButtonElement} btn
 * @param {string} loadingText
 * @param {() => Promise<void>} fn
 * @returns {() => Promise<void>}
 */
export function withLoading(btn, loadingText, fn) {
  return async (...args) => {
    if (btn?.dataset.loading) return; // prevent double-submit
    const restore = setLoading(btn, loadingText);
    try {
      await fn(...args);
    } catch (e) {
      console.error('[mdothree]', e);
      showToast(e.message || 'Something went wrong', 'error');
    } finally {
      restore();
    }
  };
}
