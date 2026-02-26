import { supabaseAdmin } from '../supabase'
import { AI_CALL } from '../openai'
import type { RssFeed } from '@/types/database'
import { detectAIRefusal, getNewsletterIdFromIssue } from './shared-context'
import type { ArticleGenerator } from './article-generator'
import type { Legacy } from './legacy'

/**
 * Step-based workflow processing module.
 * Handles the step-based (title → body → fact-check) article generation pipeline.
 */
export class StepWorkflow {
  private articleGenerator: ArticleGenerator
  private legacyRef: { processFeed: Legacy['processFeed'] } | null = null

  constructor(articleGenerator: ArticleGenerator) {
    this.articleGenerator = articleGenerator
  }

  /**
   * Set legacy module reference (avoids circular dependency)
   */
  setLegacy(legacy: { processFeed: Legacy['processFeed'] }) {
    this.legacyRef = legacy
  }

  /**
   * Public method to process a single feed - used by step-based processing
   */
  async processSingleFeed(feed: RssFeed, issueId: string, section: 'primary' | 'secondary' = 'primary') {
    if (!this.legacyRef) {
      throw new Error('Legacy module not initialized')
    }
    return await this.legacyRef.processFeed(feed, issueId, section)
  }

  /**
   * NEW WORKFLOW: Generate titles only (Step 1 of article generation)
   * Creates article records with headlines but no content
   */
  async generateTitlesOnly(issueId: string, section: 'primary' | 'secondary' = 'primary', limit: number = 6) {
    const newsletterId = await getNewsletterIdFromIssue(issueId)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'

    const { data: feeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (!feeds || feeds.length === 0) {
      console.log(`[Titles] No active feeds for ${section} section`)
      return
    }

    const feedIds = feeds.map(f => f.id)

    const { data: topPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('*, post_ratings(*)')
      .eq('issue_id', issueId)
      .in('feed_id', feedIds)

    if (!topPosts || topPosts.length === 0) {
      console.log(`[Titles] No posts assigned to issue for ${section} section`)
      return
    }

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

    console.log(`[Titles] issue has ${topPosts.length} total posts for ${section} section`)
    console.log(`[Titles] Excluding ${duplicatePostIds.size} duplicate posts`)

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

    console.log(`[Titles] After filtering: ${postsWithRatings.length} posts available (target: ${limit})`)
    console.log(`[Titles] Generating ${postsWithRatings.length} ${section} titles...`)

    // Generate titles in batch
    const BATCH_SIZE = 3
    for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
      const batch = postsWithRatings.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (post) => {
        try {
          const { data: existing, error: checkError } = await supabaseAdmin
            .from(tableName)
            .select('id')
            .eq('post_id', post.id)
            .eq('issue_id', issueId)
            .maybeSingle()

          if (checkError) {
            console.error(`[Titles] Error checking for existing article:`, checkError.message)
            return
          }

          if (existing) {
            console.log(`[Titles] Article already exists for post ${post.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || ''
          }

          const titleResult = section === 'primary'
            ? await AI_CALL.primaryArticleTitle(postData, newsletterId, 200, 0.7)
            : await AI_CALL.secondaryArticleTitle(postData, newsletterId, 200, 0.7)

          const headline = typeof titleResult === 'string'
            ? titleResult.trim()
            : (titleResult.raw || titleResult.headline || '').trim()

          if (!headline) {
            console.error(`[Titles] Failed to generate title for post ${post.id}`)
            return
          }

          const titleRefusal = detectAIRefusal(headline)
          if (titleRefusal) {
            console.error(`[Titles] AI returned refusal for post ${post.id} (matched: "${titleRefusal}"): ${headline.substring(0, 200)}`)
            return
          }

          const { error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert([{
              post_id: post.id,
              issue_id: issueId,
              headline: headline,
              content: '',
              rank: null,
              is_active: false,
              fact_check_score: null,
              fact_check_details: null,
              word_count: 0
            }])

          if (insertError) {
            if (insertError.code === '23505') {
              console.log(`[Titles] Article already created by parallel process for post ${post.id}`)
              return
            }
            console.error(`[Titles] Database insert failed for post ${post.id}:`, insertError.message)
            throw insertError
          }

          console.log(`[Titles] Generated title for post ${post.id}: "${headline.substring(0, 50)}..."`)

        } catch (error) {
          console.error(`[Titles] Failed for post ${post.id}:`, error instanceof Error ? error.message : 'Unknown')
        }
      }))

      if (i + BATCH_SIZE < postsWithRatings.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`[Titles] ✓ Generated ${postsWithRatings.length} ${section} titles`)
  }

  /**
   * NEW WORKFLOW: Generate bodies only (Step 2 of article generation)
   */
  async generateBodiesOnly(issueId: string, section: 'primary' | 'secondary' = 'primary', offset: number = 0, limit: number = 3) {
    const newsletterId = await getNewsletterIdFromIssue(issueId)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'

    const { data: articles } = await supabaseAdmin
      .from(tableName)
      .select('*, rss_posts(*)')
      .eq('issue_id', issueId)
      .eq('content', '')
      .not('headline', 'is', null)
      .order('post_id', { ascending: true })
      .limit(limit)

    if (!articles || articles.length === 0) {
      console.log(`[Bodies] No articles awaiting body generation`)
      return
    }

    console.log(`[Bodies] Found ${articles.length} articles awaiting body generation`)
    console.log(`[Bodies] Generating ${articles.length} ${section} bodies...`)

    const BATCH_SIZE = 2
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (article: any) => {
        try {
          const post = article.rss_posts
          if (!post) {
            console.error(`[Bodies] No RSS post found for article ${article.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || ''
          }

          let bodyResult = section === 'primary'
            ? await AI_CALL.primaryArticleBody(postData, newsletterId, article.headline, 500, 0.7)
            : await AI_CALL.secondaryArticleBody(postData, newsletterId, article.headline, 500, 0.7)

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
            console.error(`[Bodies] Invalid body response for article ${article.id}`)
            return
          }

          // Safety check: if content looks like a JSON object, extract the content field
          if (bodyResult.content.trimStart().startsWith('{') && bodyResult.content.trimEnd().endsWith('}')) {
            try {
              const parsed = JSON.parse(bodyResult.content)
              if (parsed && typeof parsed.content === 'string') {
                console.warn(`[Bodies] Content was raw JSON for article ${article.id}, extracting content field`)
                bodyResult.content = parsed.content
                bodyResult.word_count = parsed.word_count || parsed.content.split(/\s+/).length
              }
            } catch {
              // Not valid JSON despite looking like it, use as-is
            }
          }

          const refusalMatch = detectAIRefusal(bodyResult.content)
          if (refusalMatch) {
            console.error(`[Bodies] AI returned refusal for article ${article.id} (matched: "${refusalMatch}"): ${bodyResult.content.substring(0, 200)}`)
            return
          }

          console.log(`[Bodies] Content has \\n: ${bodyResult.content.includes('\n')}`)
          console.log(`[Bodies] Content has \\n\\n: ${bodyResult.content.includes('\n\n')}`)
          console.log(`[Bodies] Content preview: ${bodyResult.content.substring(0, 200)}`)

          await supabaseAdmin
            .from(tableName)
            .update({
              content: bodyResult.content,
              word_count: bodyResult.word_count
            })
            .eq('id', article.id)

          console.log(`[Bodies] Generated body for article ${article.id} (${bodyResult.word_count} words)`)

        } catch (error) {
          console.error(`[Bodies] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')
        }
      }))

      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    console.log(`[Bodies] ✓ Generated ${articles.length} ${section} bodies`)
  }

  /**
   * NEW WORKFLOW: Fact-check articles (Step 3 of article generation)
   */
  async factCheckArticles(issueId: string, section: 'primary' | 'secondary' = 'primary') {
    const newsletterId = await getNewsletterIdFromIssue(issueId)
    const tableName = section === 'primary' ? 'articles' : 'secondary_articles'

    const { data: articles } = await supabaseAdmin
      .from(tableName)
      .select('*, rss_posts(*)')
      .eq('issue_id', issueId)
      .neq('content', '')
      .not('content', 'is', null)
      .is('fact_check_score', null)

    if (!articles || articles.length === 0) {
      console.log(`[Fact-Check] No articles awaiting fact-check for ${section}`)
      return
    }

    console.log(`[Fact-Check] Checking ${articles.length} ${section} articles...`)

    const BATCH_SIZE = 3
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (article: any) => {
        try {
          const post = article.rss_posts
          if (!post) {
            console.error(`[Fact-Check] No RSS post found for article ${article.id}`)
            return
          }

          const originalContent = post.content || post.description || ''

          const factCheck = await this.articleGenerator.factCheckContent(article.content, originalContent, newsletterId)

          await supabaseAdmin
            .from(tableName)
            .update({
              fact_check_score: factCheck.score,
              fact_check_details: factCheck.details
            })
            .eq('id', article.id)

          console.log(`[Fact-Check] Article ${article.id}: Score ${factCheck.score}/10`)

        } catch (error) {
          console.error(`[Fact-Check] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')

          await supabaseAdmin
            .from(tableName)
            .update({
              fact_check_score: 0,
              fact_check_details: `Fact-check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
            .eq('id', article.id)
        }
      }))

      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`[Fact-Check] ✓ Checked ${articles.length} ${section} articles`)
  }
}
