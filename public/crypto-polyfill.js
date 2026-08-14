/**
 * crypto.randomUUID polyfill
 * Loaded as a blocking script before any other scripts to ensure availability
 */
(function () {
  'use strict';
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this;
    if (!g.crypto) {
      try { g.crypto = {}; } catch (e) {}
    }
    if (g.crypto && typeof g.crypto.randomUUID !== 'function') {
      var polyfill = function() {
        try {
          var buf = new Uint8Array(16);
          if (g.crypto && g.crypto.getRandomValues) {
            g.crypto.getRandomValues(buf);
          } else {
            for (var i = 0; i < 16; i++) buf[i] = (Math.random() * 256) | 0;
          }
          buf[6] = (buf[6] & 0x0f) | 0x40;
          buf[8] = (buf[8] & 0x3f) | 0x80;
          var hex = [];
          for (var i = 0; i < 16; i++) {
            var b = buf[i];
            hex.push((b < 16 ? "0" : "") + b.toString(16));
          }
          return (
            hex.slice(0, 4).join("") + "-" +
            hex.slice(4, 6).join("") + "-" +
            hex.slice(6, 8).join("") + "-" +
            hex.slice(8, 10).join("") + "-" +
            hex.slice(10, 16).join("")
          );
        } catch (e) {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (Math.random() * 16) | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        }
      };
      try {
        g.crypto.randomUUID = polyfill;
      } catch (e) {
        try {
          Object.defineProperty(g.crypto, 'randomUUID', {
            value: polyfill,
            configurable: true,
            writable: true
          });
        } catch (e2) {
          // If we can't set it, at least it tried
        }
      }
    }
  } catch (err) {
    // Silently fail - the polyfill is a best-effort enhancement
  }
})();
