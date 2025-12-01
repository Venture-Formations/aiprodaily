// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Disable performance monitoring to save quota (focus on errors only)
  tracesSampleRate: 0,

  // Disable Sentry telemetry
  telemetry: false,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error'], // Only capture console.error calls
    }),
  ],

  // Add context to errors
  beforeSend(event, hint) {
    // Add additional context if available
    const error = hint.originalException;
    if (error && typeof error === 'object' && 'publication_id' in error) {
      event.tags = {
        ...event.tags,
        publication_id: String((error as Record<string, unknown>).publication_id),
      };
    }
    return event;
  },
});
