import * as Sentry from "@sentry/nextjs"

/**
 * Sentry client-side configuration.
 * Captures browser errors, performance, and session replay.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 */
Sentry.init({
  enabled: process.env.NODE_ENV === "production",
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of sessions in production for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replay 2% of sessions, 100% on errors
  replaysSessionSampleRate: 0.02,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,    // mask PII in replays
      blockAllMedia: false,
    }),
  ],

  // Don't print debug info in production
  debug: process.env.NODE_ENV === "development",

  environment: process.env.NODE_ENV,
})
