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
   * Public method to generate newsletter articles - used by step-based processing
   */
  async generateArticlesForSection(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {
    return await this.generateNewsletterArticles(issueId, section, limit)
  }

  async generateNewsletterArticles(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 12) {
    // Get feeds for this section
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return
    }

    const feedIds = feeds.map(f => f.id)

    // Get posts with ratings and check for duplicates
    const { data: topPosts, error: queryError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        *,
        post_ratings(*)
      `)
      .eq('issue_id', issueId)
      .in('feed_id', feedIds)

    // Get duplicate post IDs to exclude
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('issue_id', issueId)

    const groupIds = duplicateGroups?.map(g => g.id) || []

    let duplicatePostIds = new Set<string>()
    if (groupIds.length > 0) {
      const { data: duplicatePosts } = await supabaseAdmin
        .from('duplicate_posts')
        .select('post_id')
        .in('group_id', groupIds)

      duplicatePostIds = new Set(duplicatePosts?.map(d => d.post_id) || [])
    }

    if (queryError) {
      return
    }

    if (!topPosts || topPosts.length === 0) {
      return
    }

    const postsWithRatings = topPosts
      .filter(post =>
        post.post_ratings?.[0] &&
        !duplicatePostIds.has(post.id) &&
        post.full_article_text
      )
      .sort((a, b) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, limit)

    if (postsWithRatings.length === 0) {
      // Try a simpler query to get posts with ratings
      const { data: allRatedPosts } = await supabaseAdmin
        .from('rss_posts')
        .select(`
          *,
          post_ratings(*)
        `)
        .eq('issue_id', issueId)
        .not('post_ratings', 'is', null)

      if (allRatedPosts && allRatedPosts.length > 0) {
        const filteredPosts = allRatedPosts
          .filter(post =>
            !duplicatePostIds.has(post.id) &&
            post.full_article_text
          )
          .sort((a, b) => {
            const scoreA = a.post_ratings?.[0]?.total_score || 0
            const scoreB = b.post_ratings?.[0]?.total_score || 0
            return scoreB - scoreA
          })
          .slice(0, limit)

        const limitedPosts = filteredPosts
        const BATCH_SIZE = 2
        for (let i = 0; i < limitedPosts.length; i += BATCH_SIZE) {
          const batch = limitedPosts.slice(i, i + BATCH_SIZE)
          const batchPromises = batch.map(async (post) => {
            try {
              await this.processPostIntoArticle(post, issueId, section)
            } catch (error) {
              // Silent failure
            }
          })
          await Promise.all(batchPromises)

          if (i + BATCH_SIZE < limitedPosts.length) {
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
      }
      return
    }

    // Process articles in batches
    const BATCH_SIZE = 2
    let processedCount = 0
    let errorCount = 0

    for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
      const batch = postsWithRatings.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map(async (post) => {
        try {
          await this.processPostIntoArticle(post, issueId, section)
          processedCount++
        } catch (error) {
          errorCount++
        }
      })

      await Promise.all(batchPromises)

      if (i + BATCH_SIZE < postsWithRatings.length) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    // Download and store images for articles
    await this.processArticleImages(issueId)
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
      throw new Error(`Invalid fact-check response: ${JSON.stringify({ score: result.score, details: result.details, resultKeys: Object.keys(result || {}), resultType: typeof result })}`)
    }

    return result as FactCheckResult
  }

  async processArticleImages(issueId: string) {
    try {
      const { data: articles, error } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          rss_post:rss_posts(
            id,
            image_url,
            title
          )
        `)
        .eq('issue_id', issueId)
        .eq('is_active', true)

      if (error || !articles) {
        return
      }

      for (const article of articles) {
        try {
          const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post

          if (!rssPost?.image_url) {
            continue
          }

          const originalImageUrl = rssPost.image_url

          try {
            const host = new URL(originalImageUrl).hostname.toLowerCase()
            if (host.endsWith('.supabase.co') || host === 'img.aiprodaily.com') continue
          } catch { /* not a valid URL, proceed with upload */ }

          const hostedUrl = await this.ctx.imageStorage.uploadImage(originalImageUrl, rssPost.title)

          if (hostedUrl) {
            await supabaseAdmin
              .from('rss_posts')
              .update({ image_url: hostedUrl })
              .eq('id', rssPost.id)
          }

        } catch (error) {
          // Silent failure
        }
      }

    } catch (error) {
      // Silent failure
    }
  }
}
