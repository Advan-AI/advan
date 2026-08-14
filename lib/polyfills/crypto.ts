/**
 * Client-side crypto.randomUUID polyfill
 * Import this at the top of any client component that needs UUID generation
 */

if (typeof window !== 'undefined') {
  try {
    const g = globalThis || window
    if (!g.crypto) {
      try {
        // @ts-ignore
        g.crypto = {}
      } catch (e) {
        // Silently fail - might be in a restricted context
      }
    }
    
    if (g.crypto && typeof g.crypto.randomUUID !== 'function') {
      const polyfill = function(): string {
        try {
          const buf = new Uint8Array(16)
          if (g.crypto && g.crypto.getRandomValues) {
            g.crypto.getRandomValues(buf)
          } else {
            // Fallback to Math.random if crypto.getRandomValues isn't available
            for (let i = 0; i < 16; i++) {
              buf[i] = (Math.random() * 256) | 0
            }
          }
          
          // Set version (4) and variant bits per RFC4122
          buf[6] = (buf[6] & 0x0f) | 0x40
          buf[8] = (buf[8] & 0x3f) | 0x80
          
          // Convert to hex string
          const hex: string[] = []
          for (let i = 0; i < 16; i++) {
            const byte = buf[i]
            hex.push((byte < 16 ? "0" : "") + byte.toString(16))
          }
          
          return (
            hex.slice(0, 4).join("") + "-" +
            hex.slice(4, 6).join("") + "-" +
            hex.slice(6, 8).join("") + "-" +
            hex.slice(8, 10).join("") + "-" +
            hex.slice(10, 16).join("")
          )
        } catch (e) {
          // Ultimate fallback using Math.random
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (Math.random() * 16) | 0
            const v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
          })
        }
      }
      
      try {
        // @ts-ignore
        g.crypto.randomUUID = polyfill
      } catch (e) {
        try {
          Object.defineProperty(g.crypto, 'randomUUID', {
            value: polyfill,
            configurable: true,
            writable: true
          })
        } catch (e2) {
          // If we can't set it, log for debugging
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[Advan] Could not install crypto.randomUUID polyfill', e2)
          }
        }
      }
    }
  } catch (err) {
    // Silently fail - the polyfill is a best-effort enhancement
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Advan] Polyfill initialization failed', err)
    }
  }
}

// Export a safe UUID generator as a fallback
export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }
  
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(16)
    window.crypto.getRandomValues(buf)
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    
    const hex: string[] = []
    for (let i = 0; i < 16; i++) {
      const byte = buf[i]
      hex.push((byte < 16 ? "0" : "") + byte.toString(16))
    }
    
    return (
      hex.slice(0, 4).join("") + "-" +
      hex.slice(4, 6).join("") + "-" +
      hex.slice(6, 8).join("") + "-" +
      hex.slice(8, 10).join("") + "-" +
      hex.slice(10, 16).join("")
    )
  }
  
  // Ultimate fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
