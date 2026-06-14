import * as Sentry from "@sentry/nextjs"

/**
 * Sentry server-side configuration.
 * Captures API errors, tRPC errors, and server-side performance.
 */
Sentry.init({
  // Only ship events in production (local/staging without production NODE_ENV stays quiet).
  enabled: process.env.NODE_ENV === "production",
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  debug: process.env.NODE_ENV === "development",

  environment: process.env.NODE_ENV,

  // Don't report auth errors from NextAuth redirects as errors
  ignoreErrors: [
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],

  beforeSend(event) {
    // Strip PII from error breadcrumbs before shipping to Sentry
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }
    return event
  },
})
