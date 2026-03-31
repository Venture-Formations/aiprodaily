import { supabaseAdmin } from '../supabase'
import { AI_CALL, callAIWithPrompt } from '../openai'
import type { RssPost, NewsletterContent, FactCheckResult } from '@/types/database'
import type { RSSProcessorContext } from './shared-context'
import { detectAIRefusal, getNewsletterIdFromIssue } from './shared-context'

/**
 * Article generation module.
 * Handles generating newsletter articles from RSS posts using AI.
 */
export class ArticleGenerator {
  private ctx: RSSProcessorContext

  constructor(ctx: RSSProcessorContext) {
    this.ctx = ctx
  }

  /**
   * @deprecated Article generation now handled by module-articles.ts pipeline.
   * This method is a no-op kept for backward compatibility.
   */
  async generateArticlesForSection(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {
    console.warn(`[DEPRECATED] ArticleGenerator.generateArticlesForSection called for ${section} — this is now handled by module-articles.ts`)
    return
  }

  /**
   * @deprecated Legacy article generation that wrote to articles/secondary_articles tables.
   * Now a no-op. Module pipeline uses generateNewsletterContent/factCheckContent directly.
   */
  async generateNewsletterArticles(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {
    console.warn(`[DEPRECATED] ArticleGenerator.generateNewsletterArticles called for ${section} — this is now handled by module-articles.ts`)
    return
  }

  async processPostIntoArticle(post: any, issueId: string, section: 'primary' | 'secondary' = 'primary') {
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'
    const { data: existingArticle } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq('post_id', post.id)
      .eq('issue_id', issueId)
      .single()

    if (existingArticle) {
      console.log(`[Article] Skipping post ${post.id} - article already exists`)
      return
    }

    let content: NewsletterContent | null = null

    try {
      content = await this.generateNewsletterContent(post, newsletterId, section)
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error(`[Article] Failed to generate content for post ${post.id}:`, errorMsg)
      return
    }

    let factCheckScore: number | null = null
    let factCheckDetails: string | null = null

    try {
      const factCheck = await this.factCheckContent(content.content, post.content || post.description || '', newsletterId)
      factCheckScore = factCheck.score
      factCheckDetails = factCheck.details
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error(`[Fact-Check] Failed for post ${post.id}, storing article anyway:`, errorMsg)
      factCheckDetails = `Fact-check failed: ${errorMsg}`
      factCheckScore = 0
    }

    try {
      const { error } = await supabaseAdmin
        .from(tableName)
        .insert([{
          post_id: post.id,
          issue_id: issueId,
          headline: content.headline,
          content: content.content,
          rank: null,
          is_active: false,
          fact_check_score: factCheckScore,
          fact_check_details: factCheckDetails,
          word_count: content.word_count
        }])

      if (error) {
        console.error(`[Article] Failed to insert article for post ${post.id}:`, error.message)
      }
    } catch (insertError) {
      const errorMsg = insertError instanceof Error
        ? insertError.message
        : typeof insertError === 'object' && insertError !== null
          ? JSON.stringify(insertError, null, 2)
          : String(insertError)
      console.error(`[Article] Database insert failed for post ${post.id}:`, errorMsg)
    }
  }

  async generateNewsletterContent(post: RssPost, newsletterId: string, section: 'primary' | 'secondary' = 'primary'): Promise<NewsletterContent> {
    const fullText = post.full_article_text || post.content || post.description || ''

    const postData = {
      title: post.title,
      description: post.description || '',
      content: fullText,
      source_url: post.source_url || ''
    }

    // Step 1: Generate title
    const titleResult = section === 'primary'
      ? await AI_CALL.primaryArticleTitle(postData, newsletterId, 200, 0.7)
      : await AI_CALL.secondaryArticleTitle(postData, newsletterId, 200, 0.7)

    const headline = typeof titleResult === 'string'
      ? titleResult.trim()
      : (titleResult.raw || titleResult.headline || '').trim()

    if (!headline) {
      throw new Error('Failed to generate article title')
    }

    const titleRefusal = detectAIRefusal(headline)
    if (titleRefusal) {
      throw new Error(`AI returned refusal instead of article title (matched: "${titleRefusal}"): ${headline.substring(0, 200)}`)
    }

    // Step 2: Generate body
    let bodyResult = section === 'primary'
      ? await AI_CALL.primaryArticleBody(postData, newsletterId, headline, 500, 0.7)
      : await AI_CALL.secondaryArticleBody(postData, newsletterId, headline, 500, 0.7)

    if ((!bodyResult.content || !bodyResult.word_count) && bodyResult.raw && typeof bodyResult.raw === 'string') {
      try {
        const parsed = JSON.parse(bodyResult.raw)
        if (parsed && parsed.content) {
          bodyResult = { content: parsed.content, word_count: parsed.word_count || parsed.content.split(/\s+/).length }
        }
      } catch {
        // not valid JSON
      }
    }

    if (!bodyResult.content || !bodyResult.word_count) {
      throw new Error('Invalid article body response')
    }

    const refusalMatch = detectAIRefusal(bodyResult.content)
    if (refusalMatch) {
      throw new Error(`AI returned refusal instead of article body (matched: "${refusalMatch}"): ${bodyResult.content.substring(0, 200)}`)
    }

    return {
      headline,
      content: bodyResult.content,
      word_count: bodyResult.word_count
    }
  }

  async factCheckContent(newsletterContent: string, originalContent: string, newsletterId: string): Promise<FactCheckResult> {
    let result
    try {
      result = await callAIWithPrompt('ai_prompt_fact_checker', newsletterId, {
        newsletter_content: newsletterContent,
        original_content: originalContent
      })
    } catch (callError) {
      throw new Error(`AI call failed for fact-checker: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
    }

    if (result && typeof result === 'object' && 'raw' in result && typeof result.raw === 'string') {
      try {
        const parsed = JSON.parse(result.raw)
        result = parsed
      } catch (parseError) {
        try {
          const codeFenceMatch = result.raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          const cleanedContent = codeFenceMatch && codeFenceMatch[1] ? codeFenceMatch[1] : result.raw
          const objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
          if (objectMatch && objectMatch[0]) {
            result = JSON.parse(objectMatch[0])
          } else {
            result = JSON.parse(cleanedContent.trim())
          }
        } catch (fallbackError) {
          const rawText = result.raw.trim()
          const isErrorMessage = rawText.startsWith('It looks like') ||
                                  rawText.startsWith('I\'m sorry') ||
                                  rawText.startsWith('Error') ||
                                  rawText.startsWith('There was an issue') ||
                                  !rawText.includes('{')

          if (isErrorMessage) {
            throw new Error(`AI returned error message instead of fact-check JSON: ${rawText.substring(0, 200)}`)
          }

          throw new Error(`Failed to parse fact-check response: ${JSON.stringify({ raw: result.raw.substring(0, 200), parseError: parseError instanceof Error ? parseError.message : String(parseError) })}`)
        }
      }
    }

    if (!result || typeof result !== 'object') {
      throw new Error(`Invalid fact-check response type: expected object, got ${typeof result}`)
    }

    if (typeof result.score !== 'number' || typeof result.details !== 'string') {
      throw new Error(`Invalid fact-check response: ${JSON.stringify({ score: result.score, details: result.details, resultKeys: Object.keys(result), resultType: typeof result })}`)
    }

    return result as FactCheckResult
  }

  // processArticleImages removed — was dead code referencing legacy articles table
}
