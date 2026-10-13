/* site-chrome.js — MDOThree shared template (source: shared/mdothree/site-chrome.js; copy to each surface's /js/).
 * The right-hand nav cluster shared by all 10 MDOThree surfaces:
 *   [ Pro (coming soon) ]  [ account ]  [ light/dark toggle ]   (the toggle is always innermost/rightmost)
 * Markup is static in every page (see shared/mdothree/site-chrome.html); this file wires it up.
 * Load: <script src="/js/site-chrome.js" defer></script>  (after theme-init.js ran in <head>).
 *
 * API for the per-surface auth adapter (js/auth-nav.js), available once 'mdo-chrome-ready' fired:
 *   mdoChrome.setUser(user | null, { signOut: async fn, accountHref: '/account', signIn: fn })
 *     user = a real (non-anonymous) Firebase user, or null. With no `signIn` handler (no sign-in flow on
 *     the surface yet) nothing is shown while signed out: we never show a button that leads nowhere.
 *   mdoChrome.setCheckout({ enabled: bool, onClick: fn, href: url })
 *     PRO_CHECKOUT_ENABLED=false (today): the control reads "Pro (coming soon)" and links to mdothree.com/pro.
 *     When enabled, the same control reads "Upgrade to Pro" and opens the surface's checkout.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'mdo-theme';

  // ── Theme ────────────────────────────────────────────────────────────────
  function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function label(btn) {
    var next = current() === 'dark' ? 'light' : 'dark';
    var text = 'Switch to ' + next + ' theme';
    btn.setAttribute('aria-label', text);
    btn.setAttribute('title', text);
    btn.setAttribute('aria-pressed', current() === 'dark' ? 'true' : 'false');
  }
  function apply(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) {
      root.removeAttribute('data-theme-source');
      try { window.localStorage.setItem(KEY, theme); } catch (e) { /* storage blocked: choice lasts this page */ }
    }
    var btns = document.querySelectorAll('[data-mdo-theme]');
    for (var i = 0; i < btns.length; i++) label(btns[i]);
    try { document.dispatchEvent(new CustomEvent('mdo-theme-change', { detail: { theme: theme } })); } catch (e) {}
  }
  var toggles = document.querySelectorAll('[data-mdo-theme]');
  for (var t = 0; t < toggles.length; t++) {
    label(toggles[t]);
    toggles[t].addEventListener('click', function () { apply(current() === 'dark' ? 'light' : 'dark', true); });
  }
  // No saved choice yet: keep following the OS setting live.
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onOs = function (e) { if (root.getAttribute('data-theme-source') === 'os') apply(e.matches ? 'dark' : 'light', false); };
    if (mq.addEventListener) mq.addEventListener('change', onOs); else if (mq.addListener) mq.addListener(onOs);
  } catch (e) {}

  // ── Pro control ──────────────────────────────────────────────────────────
  var pro = document.querySelector('[data-mdo-pro]');
  var checkoutClick = null;
  if (pro) pro.addEventListener('click', function (e) {
    if (checkoutClick) { e.preventDefault(); checkoutClick(e); }
  });
  function setCheckout(o) {
    if (!pro || !o || !o.enabled) return;   // closed: keep the honest "coming soon" link to mdothree.com/pro
    pro.classList.add('is-open');
    var main = pro.querySelector('.mdo-pro-main'); var note = pro.querySelector('.mdo-pro-note');
    if (main) main.textContent = 'Upgrade to Pro'; if (note) note.textContent = '';
    pro.setAttribute('title', 'Upgrade to mdothree Pro');
    if (o.href) pro.setAttribute('href', o.href);
    checkoutClick = typeof o.onClick === 'function' ? o.onClick : null;
  }

  // ── Account control ──────────────────────────────────────────────────────
  var slot = document.querySelector('[data-mdo-account]');
  var menuOpen = false;
  function closeMenu() {
    if (!slot || !menuOpen) return;
    menuOpen = false;
    var b = slot.querySelector('.mdo-acct-btn'), m = slot.querySelector('.mdo-acct-menu');
    if (b) b.setAttribute('aria-expanded', 'false');
    if (m) m.hidden = true;
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function setUser(user, opts) {
    if (!slot) return;
    opts = opts || {};
    slot.replaceChildren();
    menuOpen = false;
    if (!user) {
      if (typeof opts.signIn === 'function') {
        var si = el('button', 'mdo-signin', 'Sign in');
        si.type = 'button';
        si.addEventListener('click', function () { opts.signIn(); });
        slot.appendChild(si);
        slot.hidden = false;
      } else {
        slot.hidden = true;   // no sign-in flow on this surface: show nothing rather than a dead button
      }
      return;
    }
    var who = user.email || user.displayName || 'your account';
    var initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase() || '?';
    var btn = el('button', 'mdo-acct-btn');
    btn.type = 'button';
    btn.id = 'mdo-acct-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mdo-acct-menu');
    btn.setAttribute('aria-label', 'Account menu (' + who + ')');
    btn.setAttribute('title', 'Account: ' + who);
    btn.appendChild(el('span', 'mdo-avatar', initial)).setAttribute('aria-hidden', 'true');
    btn.appendChild(el('span', 'mdo-acct-label', 'Account'));
    var menu = el('div', 'mdo-acct-menu');
    menu.id = 'mdo-acct-menu';
    menu.hidden = true;
    var p = el('p', 'mdo-acct-who', 'Signed in as ');
    p.appendChild(el('strong', null, who));
    menu.appendChild(p);
    if (opts.accountHref) { var a = el('a', 'mdo-acct-item', 'Your account'); a.href = opts.accountHref; menu.appendChild(a); }
    if (typeof opts.signOut === 'function') {
      var so = el('button', 'mdo-acct-item', 'Sign out');
      so.type = 'button';
      so.setAttribute('data-mdo-signout', '');
      so.addEventListener('click', function () {
        so.disabled = true;
        Promise.resolve().then(opts.signOut).catch(function () {}).then(function () { so.disabled = false; closeMenu(); });
      });
      menu.appendChild(so);
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menuOpen = !menuOpen;
      btn.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
      menu.hidden = !menuOpen;
      if (menuOpen) { var f = menu.querySelector('a,button'); if (f) f.focus(); }
    });
    slot.appendChild(btn);
    slot.appendChild(menu);
    slot.hidden = false;
  }
  document.addEventListener('click', function (e) { if (slot && !slot.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) { closeMenu(); var b = document.getElementById('mdo-acct-btn'); if (b) b.focus(); }
  });

  // ── Icon buttons: the aria-label is also the visible tooltip ───────────────
  // Glyph-only buttons (⎘ copy, ↻ regenerate, ✕ delete/close, 👁 show) carry an aria-label for screen
  // readers; mirror it into title so sighted mouse users get the same label on hover. Also covers buttons
  // that tool scripts add later (history rows, the upgrade dialog).
  function tip(scope) {
    var list = scope.querySelectorAll ? scope.querySelectorAll('button[aria-label]:not([title])') : [];
    for (var i = 0; i < list.length; i++) list[i].setAttribute('title', list[i].getAttribute('aria-label'));
    if (scope.matches && scope.matches('button[aria-label]:not([title])')) scope.setAttribute('title', scope.getAttribute('aria-label'));
  }
  tip(document);
  try {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var n = muts[i].addedNodes[j]; if (n.nodeType === 1) tip(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  window.mdoChrome = { setUser: setUser, setCheckout: setCheckout, setTheme: function (t) { apply(t === 'dark' ? 'dark' : 'light', true); } };
  try { document.dispatchEvent(new CustomEvent('mdo-chrome-ready')); } catch (e) {}
})();
