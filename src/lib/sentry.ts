import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error with additional context for better debugging in Sentry.
 * Use this in API routes and workflow steps to add publication-specific context.
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureError(error, {
 *     source: 'process-rss-workflow',
 *     publication_id: newsletterId,
 *     step: 'fetch-articles',
 *     campaign_id: campaignId,
 *   });
 *   throw error; // Re-throw if needed
 * }
 * ```
 */
export function captureError(
  error: unknown,
  context: {
    source: string;
    publication_id?: string;
    campaign_id?: string;
    step?: string;
    [key: string]: unknown;
  }
) {
  Sentry.withScope((scope) => {
    // Set tags for filtering in Sentry dashboard
    scope.setTag('source', context.source);

    if (context.publication_id) {
      scope.setTag('publication_id', context.publication_id);
    }
    if (context.campaign_id) {
      scope.setTag('campaign_id', context.campaign_id);
    }
    if (context.step) {
      scope.setTag('step', context.step);
    }

    // Set extra context for detailed debugging
    scope.setExtras(context);

    // Capture the error
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), 'error');
    }
  });
}

/**
 * Wrap an async function to automatically capture any errors with context.
 * Useful for workflow steps and API route handlers.
 *
 * @example
 * ```ts
 * const result = await withErrorCapture(
 *   () => processRssFeed(feedUrl),
 *   { source: 'rss-processor', publication_id: pubId }
 * );
 * ```
 */
export async function withErrorCapture<T>(
  fn: () => Promise<T>,
  context: {
    source: string;
    publication_id?: string;
    [key: string]: unknown;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureError(error, context);
    throw error;
  }
}

/**
 * Add breadcrumb for tracking flow through the application.
 * These don't count against your event quota but provide context when an error occurs.
 *
 * @example
 * ```ts
 * addBreadcrumb('Started processing campaign', 'workflow', { campaign_id: '123' });
 * ```
 */
export function addBreadcrumb(
  message: string,
  category: string = 'workflow',
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}
