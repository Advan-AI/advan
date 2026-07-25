import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: {
    buildActivity: false,
  },
  output: "standalone",

  /**
   * Optional API rewrites when frontend (Vercel) and backend (Cloud Run) are hosted separately.
   */
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL
    if (backendUrl) {
      return [
        {
          source: "/api/:path*",
          destination: `${backendUrl.replace(/\/$/, "")}/api/:path*`,
        },
      ]
    }
    return []
  },

  /**
   * Security headers applied to every response.
   * CSP is set in report-only mode in dev so you can iterate without
   * breaking hot-reload; enforce in production.
   */
  async headers() {
    const isDev = process.env.NODE_ENV === "development"

    // Default CSP — all app routes except the widget iframe.
    const cspDefault = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.upstash.io http://127.0.0.1:11434 http://localhost:11434 https://api.groq.com https://sentry.io https://*.sentry.io wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")

    // Widget frame CSP — allows:
    //   • frame-ancestors *  (any embedding site may show this iframe)
    //   • connect-src includes the socket server port so socket.io works
    //   • wss: covers WebSocket upgrades in production
    const socketOrigins = [
      "'self'",
      "https://*.upstash.io",
      "ws://localhost:3002",
      "http://localhost:3002",
      "ws://127.0.0.1:3002",
      "http://127.0.0.1:3002",
      "wss:",
      "ws:",
    ].join(" ")

    const cspWidget = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${socketOrigins} http://127.0.0.1:11434 http://localhost:11434 https://api.groq.com`,
      // Permit embedding from any origin — the allowedOrigins whitelist is
      // enforced at the API/socket layer, not at the HTTP header level.
      "frame-ancestors *",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")

    const sharedHeaders = [
      { key: "X-Content-Type-Options",  value: "nosniff" },
      { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security",value: "max-age=63072000; includeSubDomains; preload" },
    ]

    return [
      // ── Widget iframe route ───────────────────────────────────────────────
      // Must come BEFORE the catch-all. Match with and without trailing slash.
      {
        source: "/chat-widget-frame",
        headers: [
          {
            key: isDev ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
            value: cspWidget,
          },
          // No X-Frame-Options — CSP frame-ancestors * controls embedding.
          ...sharedHeaders,
        ],
      },
      {
        source: "/chat-widget-frame/:path*",
        headers: [
          {
            key: isDev ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
            value: cspWidget,
          },
          ...sharedHeaders,
        ],
      },
      // ── All other routes (exclude widget frame) ───────────────────────────
      {
        source: "/((?!chat-widget-frame).*)",
        headers: [
          {
            key: isDev ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
            value: cspDefault,
          },
          { key: "X-Frame-Options", value: "DENY" },
          ...sharedHeaders,
        ],
      },
    ]
  },
}

export default nextConfig
