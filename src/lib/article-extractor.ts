import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import type { ExtractionStatus } from '@/types/database'

export interface ArticleExtractionResult {
  success: boolean
  fullText?: string
  title?: string
  excerpt?: string
  error?: string
  status: ExtractionStatus  // Explicit extraction status for tracking
}

// Paywall patterns - ONLY used when content extraction produces short/truncated content
// These are specific phrases that indicate the article itself is locked, not just site-wide CTAs
const PAYWALL_PATTERNS = [
  /subscription\s+required\s+to\s+(read|view|access)\s+this/i,
  /this\s+(article|story|content)\s+is\s+(only\s+)?(available\s+)?(for|to)\s+subscribers/i,
  /to\s+(continue|keep)\s+reading,?\s+(please\s+)?subscribe/i,
  /unlock\s+(the\s+)?(full\s+)?(article|story|content)/i,
  /subscribers[\s-]only\s+(content|article)/i,
  /you['']?ve\s+(reached|hit)\s+(your|the)\s+(free\s+)?(article|story)\s+limit/i,
  /article\s+is\s+for\s+paid\s+subscribers/i,
  /premium\s+subscribers?\s+only/i,
]

// Login patterns - ONLY used when content extraction produces short/truncated content
// These indicate the article requires login to read, not just to comment or save
const LOGIN_PATTERNS = [
  /sign\s+in\s+to\s+(continue|keep)\s+reading/i,
  /log\s+in\s+to\s+(continue|keep)\s+reading/i,
  /please\s+(log|sign)\s+in\s+to\s+(read|view|access)\s+this/i,
  /you\s+must\s+be\s+logged\s+in\s+to\s+(read|view)/i,
  /this\s+(article|content)\s+requires\s+(a\s+)?login/i,
]

// CSS selectors for active paywall elements - only visible blocking elements
// These are more specific to reduce false positives from hidden/inactive elements
const PAYWALL_SELECTORS = [
  // Specific paywall overlay/modal classes (usually visible when blocking)
  '.paywall-overlay',
  '.paywall-modal',
  '.subscription-gate',
  '.login-gate',
  '.premium-gate',
  // Known paywall provider elements
  '.piano-offer', // Piano paywall
  '.nytc-paywall', // NYT paywall
  '.tp-modal', // Piano modal
  '.pf-locked-content', // Pelcro paywall
  // Data attributes indicating locked content
  '[data-paywall="active"]',
  '[data-locked="true"]',
  '[data-content-tier="locked"]',
]

// Known paywall domains (major publications with hard paywalls)
const KNOWN_PAYWALL_DOMAINS = new Set([
  'wsj.com',
  'nytimes.com',
  'ft.com',
  'economist.com',
  'bloomberg.com',
  'theathletic.com',
  'washingtonpost.com',
  'newyorker.com',
  'wired.com',
  'hbr.org',
  'barrons.com',
  'businessinsider.com',
  'thetimes.co.uk',
  'telegraph.co.uk',
  'fortune.com',
  'forbes.com',
  'theatlantic.com',
])

export class ArticleExtractor {
  private readonly TIMEOUT_MS = 10000 // 10 seconds per article
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  /**
   * Check if a domain is known to have a paywall
   */
  private isKnownPaywallDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace('www.', '')
      return Array.from(KNOWN_PAYWALL_DOMAINS).some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      )
    } catch {
      return false
    }
  }

  /**
   * Detect paywall or login requirements in HTML content
   */
  private detectAccessRestriction(html: string, document: Document): {
    isRestricted: boolean
    status: 'paywall' | 'login_required' | null
    reason?: string
  } {
    // Check for paywall CSS selectors first (most reliable)
    for (const selector of PAYWALL_SELECTORS) {
      try {
        if (document.querySelector(selector)) {
          return {
            isRestricted: true,
            status: 'paywall',
            reason: `Found paywall element: ${selector}`
          }
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Check meta tags that indicate locked content
    const contentTierMeta = document.querySelector('meta[property="article:content_tier"]')
    if (contentTierMeta?.getAttribute('content') === 'locked') {
      return {
        isRestricted: true,
        status: 'paywall',
        reason: 'Meta tag indicates locked content (article:content_tier=locked)'
      }
    }

    // Check for paywall text patterns
    for (const pattern of PAYWALL_PATTERNS) {
      if (pattern.test(html)) {
        return {
          isRestricted: true,
          status: 'paywall',
          reason: `Matched paywall pattern: ${pattern.source.substring(0, 50)}`
        }
      }
    }

    // Check for login requirement patterns
    for (const pattern of LOGIN_PATTERNS) {
      if (pattern.test(html)) {
        return {
          isRestricted: true,
          status: 'login_required',
          reason: `Matched login pattern: ${pattern.source.substring(0, 50)}`
        }
      }
    }

    return { isRestricted: false, status: null }
  }

  /**
   * Extract full article text from a URL using Readability.js with Jina AI fallback
   * @param url - The article URL to extract content from
   * @param maxRetries - Maximum number of retry attempts (default: 1)
   * @returns ArticleExtractionResult with extracted content or error
   */
  async extractArticle(url: string, maxRetries: number = 1): Promise<ArticleExtractionResult> {
    let lastError: string | undefined
    let detectedStatus: ExtractionStatus = 'failed'

    // Log if this is a known paywall domain
    if (this.isKnownPaywallDomain(url)) {
      console.log(`[Extract] Known paywall domain, will attempt extraction: ${new URL(url).hostname}`)
    }

    // Attempt 1: Try Readability method (fast, works for most sites)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      try {
        const result = await this.fetchAndExtract(url)

        if (result.success) {
          return result
        }

        lastError = result.error
        detectedStatus = result.status

        // If we detected a paywall/login, don't retry - it won't help
        if (result.status === 'paywall' || result.status === 'login_required' || result.status === 'blocked') {
          break
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Extract] Readability attempt ${attempt + 1} failed:`, lastError)
      }
    }

    // If already detected as paywall/login/blocked, skip Jina fallback
    if (detectedStatus === 'paywall' || detectedStatus === 'login_required' || detectedStatus === 'blocked') {
      return {
        success: false,
        status: detectedStatus,
        error: lastError
      }
    }

    // Attempt 2: Try Jina AI Reader fallback (handles JS, sometimes bypasses paywalls)
    try {
      const jinaResult = await this.extractWithJina(url)

      if (jinaResult.success) {
        return jinaResult
      }

      lastError = `Readability failed, Jina AI failed: ${jinaResult.error}`
      detectedStatus = jinaResult.status
    } catch (error) {
      const jinaError = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Extract] Jina AI error:`, jinaError)
      lastError = `Readability failed, Jina AI error: ${jinaError}`
    }

    return {
      success: false,
      status: detectedStatus,
      error: lastError || 'All extraction methods failed'
    }
  }

  /**
   * Fetch HTML and extract article content
   * Strategy: Extract first, only check for paywall indicators if content is short/missing
   */
  private async fetchAndExtract(url: string): Promise<ArticleExtractionResult> {
    try {
      // Fetch HTML with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      })

      clearTimeout(timeoutId)

      // Check for blocked/forbidden responses
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          status: 'blocked',
          error: `HTTP ${response.status}: Access denied`
        }
      }

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const html = await response.text()

      if (!html || html.length < 100) {
        return {
          success: false,
          status: 'failed',
          error: 'HTML response too short or empty'
        }
      }

      // Parse with linkedom
      const { document } = parseHTML(html)

      // EXTRACT FIRST - don't check for paywall patterns before attempting extraction
      const reader = new Readability(document, {
        charThreshold: 100, // Minimum character count
        debug: false
      })

      const article = reader.parse()

      // If Readability can't parse, check for restriction indicators
      if (!article) {
        const restriction = this.detectAccessRestriction(html, document)
        if (restriction.isRestricted && restriction.status) {
          return {
            success: false,
            status: restriction.status,
            error: restriction.reason
          }
        }
        return {
          success: false,
          status: 'failed',
          error: 'Readability failed to parse article'
        }
      }

      // Clean up the text content
      const fullText = article.textContent?.trim() || ''

      // If we got enough content, it's a success - don't check for paywall patterns
      // (If content was paywalled, we wouldn't have gotten this much text)
      if (fullText && fullText.length >= 500) {
        return {
          success: true,
          status: 'success',
          fullText,
          title: article.title || undefined,
          excerpt: article.excerpt || undefined
        }
      }

      // Short content - might be truncated by paywall, check for indicators
      if (!fullText || fullText.length < 200) {
        // Check for paywall/login indicators since content is short
        const restriction = this.detectAccessRestriction(html, document)
        if (restriction.isRestricted && restriction.status) {
          return {
            success: false,
            status: restriction.status,
            error: `${restriction.reason} (extracted only ${fullText.length} chars)`
          }
        }

        // Known paywall domain with short content = likely paywall
        if (this.isKnownPaywallDomain(url)) {
          return {
            success: false,
            status: 'paywall',
            error: `Content truncated (${fullText.length} chars) - likely paywall on known paywall domain`
          }
        }
        return {
          success: false,
          status: 'failed',
          error: `Extracted text too short (${fullText.length} chars)`
        }
      }

      // Content between 200-500 chars - borderline, but return as success
      // This avoids false positives from short news briefs
      return {
        success: true,
        status: 'success',
        fullText,
        title: article.title || undefined,
        excerpt: article.excerpt || undefined
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, status: 'timeout', error: 'Request timeout' }
        }
        return { success: false, status: 'failed', error: error.message }
      }
      return { success: false, status: 'failed', error: 'Unknown error during extraction' }
    }
  }

  /**
   * Extract article using Jina AI Reader API (fallback method)
   * Handles JS-rendered content and bypasses some paywalls
   * @param url - The article URL to extract
   * @returns ArticleExtractionResult
   */
  private async extractWithJina(url: string): Promise<ArticleExtractionResult> {
    try {
      // Jina AI Reader: prefix URL with https://r.jina.ai/
      const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS)

      const response = await fetch(jinaUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/plain',
          'User-Agent': this.USER_AGENT,
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          error: `Jina API HTTP ${response.status}`
        }
      }

      // Jina returns markdown text
      const markdown = await response.text()

      // Check if Jina's response indicates a paywall
      const markdownLower = markdown.toLowerCase()
      if (markdownLower.includes('subscription required') ||
          markdownLower.includes('subscribe to continue') ||
          markdownLower.includes('paywall') ||
          markdownLower.includes('premium content')) {
        return {
          success: false,
          status: 'paywall',
          error: 'Jina detected paywall content in response'
        }
      }

      if (markdownLower.includes('sign in to continue') ||
          markdownLower.includes('log in to continue') ||
          markdownLower.includes('login required')) {
        return {
          success: false,
          status: 'login_required',
          error: 'Jina detected login requirement in response'
        }
      }

      if (!markdown || markdown.length < 200) {
        // Short content from known paywall domain = likely paywall
        if (this.isKnownPaywallDomain(url)) {
          return {
            success: false,
            status: 'paywall',
            error: `Jina returned short content (${markdown.length} chars) - likely paywall`
          }
        }
        return {
          success: false,
          status: 'failed',
          error: `Jina returned short content (${markdown.length} chars)`
        }
      }

      // Extract title from first line (usually # Title format)
      const lines = markdown.split('\n')
      const titleLine = lines.find(line => line.startsWith('# '))
      const title = titleLine ? titleLine.replace('# ', '').trim() : undefined

      // Remove markdown formatting for plain text
      const fullText = markdown
        .replace(/^#+\s+/gm, '') // Remove headers
        .replace(/\*\*/g, '') // Remove bold
        .replace(/\*/g, '') // Remove italic
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
        .trim()

      if (!fullText || fullText.length < 200) {
        return {
          success: false,
          status: 'failed',
          error: `Jina text too short after cleanup (${fullText.length} chars)`
        }
      }

      return {
        success: true,
        status: 'success',
        fullText,
        title,
        excerpt: fullText.substring(0, 200) + '...'
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, status: 'timeout', error: 'Jina request timeout' }
        }
        return { success: false, status: 'failed', error: `Jina error: ${error.message}` }
      }
      return { success: false, status: 'failed', error: 'Jina unknown error' }
    }
  }

  /**
   * Extract articles in parallel batches
   * @param urls - Array of URLs to extract
   * @param batchSize - Number of concurrent extractions (default: 5)
   * @returns Map of URL to extraction result
   */
  async extractBatch(
    urls: string[],
    batchSize: number = 5
  ): Promise<Map<string, ArticleExtractionResult>> {
    const results = new Map<string, ArticleExtractionResult>()

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(urls.length / batchSize)

      const batchPromises = batch.map(async (url) => {
        const result = await this.extractArticle(url)
        results.set(url, result)
        return { url, result }
      })

      await Promise.all(batchPromises)

      // Enhanced batch logging with status breakdown
      const batchSuccess = batch.filter(url => results.get(url)?.success).length
      const batchPaywall = batch.filter(url => results.get(url)?.status === 'paywall').length
      const batchLogin = batch.filter(url => results.get(url)?.status === 'login_required').length
      const batchBlocked = batch.filter(url => results.get(url)?.status === 'blocked').length
      const batchFailed = batch.length - batchSuccess - batchPaywall - batchLogin - batchBlocked

      console.log(`[Extract] Batch ${batchNum}/${totalBatches}: ${batchSuccess} success, ${batchPaywall} paywall, ${batchLogin} login, ${batchBlocked} blocked, ${batchFailed} failed`)

      // Small delay between batches to be polite to servers
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const totalSuccess = Array.from(results.values()).filter(r => r.success).length
    const totalPaywall = Array.from(results.values()).filter(r => r.status === 'paywall').length
    const totalLogin = Array.from(results.values()).filter(r => r.status === 'login_required').length

    console.log(`[Extract] Total: ${totalSuccess}/${results.size} success, ${totalPaywall} paywall, ${totalLogin} login required`)

    return results
  }
}
