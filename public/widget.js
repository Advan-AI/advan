/**
 * Advan Chat Widget Embed Loader
 *
 * Usage:
 *   <script src="https://yourapp.com/widget.js" data-key="wk_xxx"></script>
 *
 * The loader:
 *   1. Reads data-key from the script tag.
 *   2. Injects a floating bubble button (bottom-right corner).
 *   3. On click, opens a sandboxed iframe pointing to /chat-widget-frame.
 *   4. Listens for postMessage from the frame for close signals only.
 *
 * No external dependencies — vanilla JS, no framework, no bundler required.
 */
(function () {
  'use strict';

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  var currentScript = document.currentScript;
  var widgetKey = currentScript && currentScript.getAttribute('data-key');
  if (!widgetKey) {
    if (typeof console !== 'undefined') {
      console.warn('[Advan Widget] Missing data-key attribute on <script> tag.');
    }
    return;
  }

  // Derive the app base URL from the script src so the loader works on any
  // domain without hard-coding the host.
  var scriptSrc = (currentScript && currentScript.src) || '';
  var baseUrl = '';
  try {
    baseUrl = new URL(scriptSrc).origin;
  } catch (_) {
    baseUrl = window.location.origin;
  }

  // Pass the embedding page's origin so the widget frame can forward it to the
  // session endpoint (allowedOrigins check).  This is done via the URL, not
  // postMessage, so we never need to cross the iframe boundary for auth.
  var FRAME_URL =
    baseUrl +
    '/chat-widget-frame?key=' +
    encodeURIComponent(widgetKey) +
    '&origin=' +
    encodeURIComponent(window.location.origin);

  var FRAME_ORIGIN = baseUrl;

  // ── Dimensions ─────────────────────────────────────────────────────────────
  var PANEL_W   = 380;
  var PANEL_H   = 580;
  var BUBBLE_SZ = 56;
  var MARGIN    = 20;
  var Z         = 2147483647;

  // ── SVG icons ──────────────────────────────────────────────────────────────
  var ICON_CHAT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"' +
    ' fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var ICON_CLOSE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"' +
    ' fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ── Styles ─────────────────────────────────────────────────────────────────
  var panelBottom = MARGIN + BUBBLE_SZ + 8;

  var css = [
    '#advan-bubble{',
    '  all:unset;',
    '  position:fixed;bottom:' + MARGIN + 'px;right:' + MARGIN + 'px;',
    '  width:' + BUBBLE_SZ + 'px;height:' + BUBBLE_SZ + 'px;',
    '  border-radius:50%;background:#1a1628;cursor:pointer;',
    '  box-shadow:0 4px 20px rgba(0,0,0,.28),0 1px 4px rgba(0,0,0,.16);',
    '  display:flex;align-items:center;justify-content:center;',
    '  z-index:' + Z + ';',
    '  transition:transform .18s ease,box-shadow .18s ease,background .15s ease;',
    '}',
    '#advan-bubble:hover{',
    '  transform:scale(1.07);',
    '  box-shadow:0 6px 28px rgba(0,0,0,.35),0 2px 8px rgba(0,0,0,.18);',
    '  background:#2c2250;',
    '}',
    '#advan-bubble:focus-visible{',
    '  outline:2px solid #6B5CD6;outline-offset:3px;',
    '}',
    '#advan-bubble svg{pointer-events:none;}',

    '#advan-panel{',
    '  position:fixed;',
    '  bottom:' + panelBottom + 'px;right:' + MARGIN + 'px;',
    '  width:' + PANEL_W + 'px;height:' + PANEL_H + 'px;',
    '  border-radius:16px;overflow:hidden;',
    '  box-shadow:0 8px 40px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.12);',
    '  z-index:' + (Z - 1) + ';',
    '  display:none;',
    '  transform-origin:bottom right;',
    '}',
    '#advan-panel.advan-open{display:block;}',
    '#advan-panel.advan-enter{animation:advan-pop .22s cubic-bezier(0.22,1,0.36,1) forwards;}',

    '#advan-panel iframe{',
    '  width:100%;height:100%;border:none;display:block;background:#f5f0e8;',
    '}',

    '@keyframes advan-pop{',
    '  from{opacity:0;transform:scale(.94) translateY(10px);}',
    '  to  {opacity:1;transform:scale(1)   translateY(0);}',
    '}',

    // Mobile: full-width, docked above bubble
    '@media(max-width:440px){',
    '  #advan-panel{',
    '    width:100%;right:0;',
    '    border-radius:16px 16px 0 0;',
    '  }',
    '}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Bubble button ──────────────────────────────────────────────────────────
  var bubble = document.createElement('button');
  bubble.id = 'advan-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.setAttribute('aria-expanded', 'false');
  bubble.setAttribute('aria-controls', 'advan-panel');
  bubble.setAttribute('type', 'button');
  bubble.innerHTML = ICON_CHAT;

  // ── Panel + iframe ─────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = 'advan-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Chat with us');

  var iframe = document.createElement('iframe');
  iframe.src = FRAME_URL;
  iframe.setAttribute('title', 'Chat widget');
  // allow-same-origin: required for socket.io (localStorage, cookies) and
  // for calling same-origin API routes from inside the frame.
  // allow-scripts + allow-forms: render React app and submit forms.
  // allow-popups: permits links that open in a new tab.
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');
  iframe.setAttribute('loading', 'lazy');
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';

  panel.appendChild(iframe);

  // ── State + toggle ─────────────────────────────────────────────────────────
  var isOpen = false;

  function openPanel() {
    isOpen = true;
    panel.classList.add('advan-open');
    // Trigger enter animation on each open.
    panel.classList.remove('advan-enter');
    // Force reflow so the animation replays reliably.
    void panel.offsetWidth;
    panel.classList.add('advan-enter');
    bubble.setAttribute('aria-expanded', 'true');
    bubble.innerHTML = ICON_CLOSE;
    bubble.setAttribute('aria-label', 'Close chat');
    // Move focus into the iframe for accessibility.
    iframe.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('advan-open', 'advan-enter');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.innerHTML = ICON_CHAT;
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.focus();
  }

  bubble.addEventListener('click', function () {
    if (isOpen) { closePanel(); } else { openPanel(); }
  });

  // Escape key closes the panel when focus is inside.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // ── postMessage bus ────────────────────────────────────────────────────────
  // Only handle messages originating from the frame's base URL.
  // Supported message types:
  //   { type: 'advan:close' }  — frame requests the panel to close
  //   { type: 'advan:ready' }  — frame signals it finished mounting
  window.addEventListener('message', function (e) {
    if (e.origin !== FRAME_ORIGIN) return;
    var data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'advan:close') closePanel();
  });

  // ── Mount ──────────────────────────────────────────────────────────────────
  document.body.appendChild(bubble);
  document.body.appendChild(panel);
})();
