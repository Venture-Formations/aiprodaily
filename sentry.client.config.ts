// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production to avoid noise during development
  enabled: process.env.NODE_ENV === "production",

  // Adjust this value in production, or use tracesSampler for greater control
  // Set to 0 to disable performance monitoring (saves quota)
  tracesSampleRate: 0,

  // Disable Sentry telemetry
  telemetry: false,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay is disabled to save quota - enable if needed for debugging UI issues
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  // Filter out known non-critical errors
  beforeSend(event) {
    // Don't send errors from browser extensions
    if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
      frame => frame.filename?.includes('extension')
    )) {
      return null;
    }
    return event;
  },
});
