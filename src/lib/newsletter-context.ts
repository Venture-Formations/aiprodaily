import { NextRequest } from 'next/server'
import { headers } from 'next/headers'

/**
 * Newsletter context extracted from middleware
 */
export interface NewsletterContext {
  publication_id: string
  newsletter_slug: string
}

/**
 * Extract newsletter context from request headers (set by middleware)
 *
 * Usage in API routes:
 * ```typescript
 * const context = await getNewsletterContext(request)
 * if (!context) {
 *   return NextResponse.json({ error: 'Newsletter context required' }, { status: 400 })
 * }
 * ```
 */
export async function getNewsletterContext(request?: NextRequest): Promise<NewsletterContext | null> {
  try {
    // If request is provided, use it directly
    if (request) {
      const newsletterId = request.headers.get('x-newsletter-id')
      const newsletterSlug = request.headers.get('x-newsletter-slug')

      if (newsletterId && newsletterSlug) {
        return {
          publication_id: newsletterId,
          newsletter_slug: newsletterSlug
        }
      }
    }
    // Otherwise, use Next.js headers() for App Router
    else {
      const headersList = await headers()
      const newsletterId = headersList.get('x-newsletter-id')
      const newsletterSlug = headersList.get('x-newsletter-slug')

      if (newsletterId && newsletterSlug) {
        return {
          publication_id: newsletterId,
          newsletter_slug: newsletterSlug
        }
      }
    }

    return null
  } catch (error) {
    console.error('[Newsletter Context] Error extracting context:', error)
    return null
  }
}

/**
 * Get newsletter context or throw error
 * Use this when newsletter context is absolutely required
 */
export async function requireNewsletterContext(request?: NextRequest): Promise<NewsletterContext> {
  const context = await getNewsletterContext(request)

  if (!context) {
    throw new Error('Newsletter context is required but not found. Ensure request is from a newsletter subdomain.')
  }

  return context
}
