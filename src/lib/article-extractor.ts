import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

export interface ArticleExtractionResult {
  success: boolean
  fullText?: string
  title?: string
  excerpt?: string
  error?: string
}

export class ArticleExtractor {
  private readonly TIMEOUT_MS = 10000 // 10 seconds per article
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  /**
   * Extract full article text from a URL using Readability.js
   * @param url - The article URL to extract content from
   * @param maxRetries - Maximum number of retry attempts (default: 1)
   * @returns ArticleExtractionResult with extracted content or error
   */
  async extractArticle(url: string, maxRetries: number = 1): Promise<ArticleExtractionResult> {
    let lastError: string | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} for: ${url}`)
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      try {
        const result = await this.fetchAndExtract(url)

        if (result.success) {
          console.log(`✅ Successfully extracted article: ${url}`)
          return result
        }

        lastError = result.error
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Extraction attempt ${attempt + 1} failed for ${url}:`, lastError)
      }
    }

    return {
      success: false,
      error: lastError || 'Extraction failed after retries'
    }
  }

  /**
   * Fetch HTML and extract article content
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

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const html = await response.text()

      if (!html || html.length < 100) {
        return {
          success: false,
          error: 'HTML response too short or empty'
        }
      }

      // Parse with linkedom
      const { document } = parseHTML(html)

      // Use Readability to extract article content
      const reader = new Readability(document, {
        charThreshold: 100, // Minimum character count
        debug: false
      })

      const article = reader.parse()

      if (!article) {
        return {
          success: false,
          error: 'Readability failed to parse article'
        }
      }

      // Clean up the text content
      const fullText = article.textContent?.trim() || ''

      if (!fullText || fullText.length < 200) {
        return {
          success: false,
          error: `Extracted text too short (${fullText.length} chars)`
        }
      }

      return {
        success: true,
        fullText,
        title: article.title || undefined,
        excerpt: article.excerpt || undefined
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Request timeout' }
        }
        return { success: false, error: error.message }
      }
      return { success: false, error: 'Unknown error during extraction' }
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

    console.log(`Starting batch extraction of ${urls.length} articles (batch size: ${batchSize})`)

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(urls.length / batchSize)

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} articles)`)

      const batchPromises = batch.map(async (url) => {
        const result = await this.extractArticle(url)
        results.set(url, result)
        return { url, result }
      })

      await Promise.all(batchPromises)

      // Log batch results
      const batchSuccess = batch.filter(url => results.get(url)?.success).length
      const batchFailed = batch.length - batchSuccess
      console.log(`Batch ${batchNum} complete: ${batchSuccess} successful, ${batchFailed} failed`)

      // Small delay between batches to be polite to servers
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const totalSuccess = Array.from(results.values()).filter(r => r.success).length
    const totalFailed = results.size - totalSuccess
    console.log(`Batch extraction complete: ${totalSuccess}/${results.size} successful, ${totalFailed} failed`)

    return results
  }
}
