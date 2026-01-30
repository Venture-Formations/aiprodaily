/**
 * Facebook Graph API Service
 * Handles posting to Facebook Pages and token verification
 */

const FACEBOOK_API_VERSION = 'v22.0'
const FACEBOOK_BASE_URL = 'https://graph.facebook.com'

export interface FacebookPostResult {
  success: boolean
  postId?: string
  error?: string
}

export interface TokenVerifyResult {
  valid: boolean
  expiresAt?: Date
  scopes?: string[]
  error?: string
}

export interface CreatePostOptions {
  message: string
  imageUrl?: string
  linkUrl?: string
}

export class FacebookService {
  private pageAccessToken: string
  private pageId: string

  constructor(pageId: string, accessToken: string) {
    this.pageId = pageId
    this.pageAccessToken = accessToken
  }

  /**
   * Post to Facebook Page with optional image and link
   * If imageUrl is provided, uses /photos endpoint
   * Otherwise uses /feed endpoint
   */
  async createPagePost(options: CreatePostOptions): Promise<FacebookPostResult> {
    const { message, imageUrl, linkUrl } = options

    try {
      let endpoint: string
      let body: Record<string, string>

      if (imageUrl) {
        // Use photos endpoint for posts with images
        endpoint = `${FACEBOOK_BASE_URL}/${FACEBOOK_API_VERSION}/${this.pageId}/photos`
        body = {
          access_token: this.pageAccessToken,
          message: message,
          url: imageUrl, // Facebook fetches the image from this URL
        }
      } else {
        // Use feed endpoint for text-only posts
        endpoint = `${FACEBOOK_BASE_URL}/${FACEBOOK_API_VERSION}/${this.pageId}/feed`
        body = {
          access_token: this.pageAccessToken,
          message: message,
        }

        // Add link if provided (for posts without images)
        if (linkUrl) {
          body.link = linkUrl
        }
      }

      console.log('[Facebook] Posting to:', endpoint)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[Facebook] API error:', data)
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        }
      }

      // Facebook returns { id: "page_id_post_id" } for feed posts
      // or { id: "photo_id", post_id: "page_id_post_id" } for photo posts
      const postId = data.post_id || data.id
      console.log('[Facebook] Post created successfully:', postId)

      return {
        success: true,
        postId: postId,
      }
    } catch (error) {
      console.error('[Facebook] Request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Verify that the access token is still valid
   * Returns expiration date and scopes if valid
   */
  async verifyToken(): Promise<TokenVerifyResult> {
    try {
      const endpoint = `${FACEBOOK_BASE_URL}/debug_token?input_token=${this.pageAccessToken}&access_token=${this.pageAccessToken}`

      const response = await fetch(endpoint)
      const data = await response.json()

      if (!response.ok || data.error) {
        return {
          valid: false,
          error: data.error?.message || 'Token verification failed',
        }
      }

      const tokenData = data.data
      if (!tokenData.is_valid) {
        return {
          valid: false,
          error: tokenData.error?.message || 'Token is invalid',
        }
      }

      return {
        valid: true,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : undefined,
        scopes: tokenData.scopes,
      }
    } catch (error) {
      console.error('[Facebook] Token verification failed:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get basic page info to verify Page ID and token work together
   */
  async getPageInfo(): Promise<{ success: boolean; name?: string; error?: string }> {
    try {
      const endpoint = `${FACEBOOK_BASE_URL}/${FACEBOOK_API_VERSION}/${this.pageId}?fields=name,id&access_token=${this.pageAccessToken}`

      const response = await fetch(endpoint)
      const data = await response.json()

      if (!response.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || 'Failed to get page info',
        }
      }

      return {
        success: true,
        name: data.name,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Strip HTML tags from content and decode HTML entities
   * Preserves newline spacing from the original content
   */
  static stripHtml(html: string): string {
    if (!html) return ''

    let text = html

    // Convert block-level HTML elements to newlines before stripping
    // Handle <br>, <br/>, <br />
    text = text.replace(/<br\s*\/?>/gi, '\n')
    // Handle closing block tags (add newline after)
    text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    // Handle opening block tags that should create spacing
    text = text.replace(/<(p|div|h[1-6])(\s[^>]*)?>/gi, '\n')

    // Remove remaining HTML tags
    text = text.replace(/<[^>]*>/g, '')

    // Decode common HTML entities
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '...',
      '&bull;': '•',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
    }

    for (const [entity, char] of Object.entries(entities)) {
      text = text.replace(new RegExp(entity, 'gi'), char)
    }

    // Decode numeric HTML entities (&#123; format)
    text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))

    // Clean up whitespace while preserving newlines
    // Replace multiple spaces/tabs (but not newlines) with single space
    text = text.replace(/[^\S\n]+/g, ' ')
    // Normalize multiple consecutive newlines to double newline (paragraph break)
    text = text.replace(/\n{3,}/g, '\n\n')
    // Remove spaces at the start/end of lines
    text = text.replace(/^ +| +$/gm, '')
    // Trim leading/trailing whitespace
    text = text.trim()

    return text
  }

  /**
   * Format ad content into a Facebook-friendly message
   * Combines body text with CTA link
   */
  static formatMessage(body: string, ctaUrl?: string): string {
    // Strip HTML from body
    const cleanBody = FacebookService.stripHtml(body)

    // Build message
    let message = cleanBody

    // Add CTA link if provided
    if (ctaUrl) {
      message += `\n\nLearn more: ${ctaUrl}`
    }

    // Facebook's message limit is 63,206 characters
    // Truncate if needed (unlikely for ad content)
    const MAX_LENGTH = 63000
    if (message.length > MAX_LENGTH) {
      message = message.substring(0, MAX_LENGTH - 3) + '...'
    }

    return message
  }
}

/**
 * Retry wrapper for Facebook API calls
 * Retries on network errors with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[Facebook] Attempt ${attempt + 1} failed:`, lastError.message)

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }

  throw lastError
}
