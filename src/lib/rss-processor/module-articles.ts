import { supabaseAdmin } from '../supabase'
import { AI_CALL, callOpenAI } from '../openai'
import { normalizeTransactionType } from '../transaction-type'
import { detectAIRefusal, getNewsletterIdFromIssue } from './shared-context'
import { selectPostsWithTickerCooldown } from './ticker-cooldown'
import {
  getIssueById,
  listPostsForScoring,
  assignPostsToIssue,
  listAssignedPostsForModule,
  POST_WITH_RATINGS_BRIEF,
  moduleArticleExists,
  insertModuleArticle,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listDuplicateGroupIdsByIssue,
  listDuplicatePostIdsByGroups,
  listRecentlyFeaturedTickers,
} from '@/lib/dal'
import type { ArticleGenerator } from './article-generator'

/**
 * Module-based article generation methods.
 * Works with the article_modules system for content generation.
 */
export class ModuleArticles {
  private articleGenerator: ArticleGenerator

  constructor(articleGenerator: ArticleGenerator) {
    this.articleGenerator = articleGenerator
  }

  /**
   * Assign top posts to a module based on its feeds
   */
  async assignPostsToModule(issueId: string, moduleId: string): Promise<{ assigned: number; filtered?: number }> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')

    const mod = await ArticleModuleSelector.getModule(moduleId)
    if (!mod) {
      console.log(`[Module] Module ${moduleId} not found`)
      return { assigned: 0 }
    }

    const feedIds = await ArticleModuleSelector.getModuleFeeds(moduleId)
    if (feedIds.length === 0) {
      console.log(`[Module] No feeds assigned to mod ${mod.name}`)
      return { assigned: 0 }
    }

    // Get criteria with minimum enforcement enabled
    const { data: criteriaWithMinimums } = await supabaseAdmin
      .from('article_module_criteria')
      .select('criteria_number, minimum_score, name')
      .eq('article_module_id', moduleId)
      .eq('is_active', true)
      .eq('enforce_minimum', true)
      .not('minimum_score', 'is', null)

    const minimumFilters = criteriaWithMinimums || []
    const hasMinimumFilters = minimumFilters.length > 0

    if (hasMinimumFilters) {
      console.log(`[Module] Minimum score filters for ${mod.name}:`)
      minimumFilters.forEach(c => {
        console.log(`  - Criteria ${c.criteria_number} (${c.name}): minimum ${c.minimum_score}`)
      })
    }

    const lookbackHours = mod.lookback_hours || 72
    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
    const lookbackTimestamp = lookbackDate.toISOString()

    const articlesNeeded = mod.articles_count || 3
    const candidateMultiplier = (mod.config as Record<string, any>)?.candidate_multiplier
    const postsToAssign = typeof candidateMultiplier === 'number'
      ? articlesNeeded + candidateMultiplier
      : articlesNeeded * 4

    console.log(`[Module] Querying posts: feedIds=${JSON.stringify(feedIds)}, lookback=${lookbackTimestamp}, postsToAssign=${postsToAssign}`)

    const topPosts = await listPostsForScoring(feedIds, {
      unassignedOnly: true,
      sinceTimestamp: lookbackTimestamp,
      requireRating: true,
      columns: POST_WITH_RATINGS_BRIEF,
    })

    if (!topPosts || topPosts.length === 0) {
      // Debug: check without the post_ratings filter
      const unfilteredPosts = await listPostsForScoring(feedIds, {
        unassignedOnly: true,
        sinceTimestamp: lookbackTimestamp,
        columns: 'id',
      })

      console.log(`[Module] No available posts for mod ${mod.name} (unfiltered count: ${unfilteredPosts.length})`)
      return { assigned: 0 }
    }

    // Filter posts by minimum criteria scores
    let eligiblePosts = topPosts
    let filteredCount = 0

    if (hasMinimumFilters) {
      const failedCriteriaDetails: Record<string, number> = {}

      eligiblePosts = topPosts.filter((post: any) => {
        const rating = post.post_ratings?.[0]
        if (!rating) return false

        for (const filter of minimumFilters) {
          const scoreKey = `criteria_${filter.criteria_number}_score`
          const score = rating[scoreKey]

          if (score === null || score === undefined || score < filter.minimum_score) {
            filteredCount++
            failedCriteriaDetails[filter.name] = (failedCriteriaDetails[filter.name] || 0) + 1
            return false
          }
        }
        return true
      })

      if (filteredCount > 0) {
        console.log(`[Module] Filtered ${filteredCount} posts that didn't meet minimum scores for ${mod.name}:`)
        Object.entries(failedCriteriaDetails).forEach(([name, count]) => {
          console.log(`  - ${name}: ${count} failed`)
        })
        console.log(`[Module] ${eligiblePosts.length} posts remain eligible`)
      }
    }

    if (eligiblePosts.length === 0) {
      console.log(`[Module] No posts meet minimum criteria for mod ${mod.name}`)
      return { assigned: 0, filtered: filteredCount }
    }

    // Sort by total score descending
    const sortedPosts = eligiblePosts
      .sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })

    // Cross-issue ticker cooldown — per-module config. Absent / < 1 = disabled;
    // floored and capped at 90 days as defense against malformed config.
    const cooldownDaysRaw = (mod.config as Record<string, any>)?.ticker_cooldown_days
    const cooldownDays =
      typeof cooldownDaysRaw === 'number' && cooldownDaysRaw >= 1
        ? Math.min(Math.floor(cooldownDaysRaw), 90)
        : 0
    let cooldownTickers = new Set<string>()
    if (cooldownDays >= 1) {
      // getIssueById logs its own errors and returns null on failure, so a DB
      // problem degrades safely to "no cooldown" instead of silently swallowing.
      const issueRow = await getIssueById(issueId)
      if (issueRow?.publication_id && issueRow?.date) {
        cooldownTickers = await listRecentlyFeaturedTickers(
          issueRow.publication_id,
          issueRow.date,
          cooldownDays,
          issueId
        )
      } else {
        console.warn(`[Module] Ticker cooldown: could not resolve issue ${issueId} — cooldown skipped this run`)
      }
    }

    // Select top posts: 1 per ticker, skipping tickers on cooldown. Backfill
    // ensures the module is never short purely because of the cooldown.
    const { selected: selectedPosts, skippedByCooldown, backfilled } =
      selectPostsWithTickerCooldown(sortedPosts, cooldownTickers, articlesNeeded, postsToAssign)

    if (cooldownDays >= 1) {
      console.log(`[Module] Ticker cooldown (${cooldownDays}d): ${sortedPosts.length} candidates → ${selectedPosts.length} selected, ${skippedByCooldown} skipped (cooldown), ${backfilled} backfilled`)
    }

    if (selectedPosts.length > 0) {
      const ok = await assignPostsToIssue(
        selectedPosts.map((p: any) => p.id),
        issueId,
        { moduleId }
      )
      if (!ok) {
        console.warn(`[Module] ⚠️ Failed to assign ${selectedPosts.length} posts for mod ${mod.name} (issue ${issueId})`)
      }
    }

    console.log(`[Module] Assigned ${selectedPosts.length} posts to mod ${mod.name}${filteredCount > 0 ? ` (${filteredCount} filtered by minimum scores)` : ''}`)
    return { assigned: selectedPosts.length, filtered: filteredCount }
  }

  /**
   * Generate titles for articles in a module
   */
  async generateTitlesForModule(issueId: string, moduleId: string): Promise<void> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const mod = await ArticleModuleSelector.getModule(moduleId)
    if (!mod) {
      console.log(`[Module Titles] Module ${moduleId} not found`)
      return
    }

    const feedIds = await ArticleModuleSelector.getModuleFeeds(moduleId)
    if (feedIds.length === 0) {
      console.log(`[Module Titles] No feeds for mod ${mod.name}`)
      return
    }

    const posts = await listAssignedPostsForModule(issueId, moduleId, feedIds)

    if (!posts || posts.length === 0) {
      console.log(`[Module Titles] No posts assigned to mod ${mod.name}`)
      return
    }

    // Get duplicate post IDs to exclude
    const groupIds = await listDuplicateGroupIdsByIssue(issueId)
    const duplicatePostIds = await listDuplicatePostIdsByGroups(groupIds)

    const { prompts } = await ArticleModuleSelector.getModulePrompts(moduleId)
    const titlePrompt = prompts.find(p => p.prompt_type === 'article_title')

    const limit = mod.articles_count ? mod.articles_count * 2 : 6
    const postsWithRatings = posts
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

    console.log(`[Module Titles] Generating ${postsWithRatings.length} titles for ${mod.name}...`)

    const BATCH_SIZE = 3
    for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
      const batch = postsWithRatings.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (post: any) => {
        try {
          if (await moduleArticleExists(post.id, issueId, moduleId)) {
            console.log(`[Module Titles] Article already exists for post ${post.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || '',
            transaction_type: normalizeTransactionType((post as any).transaction_type)
          }

          let titleResult
          if (titlePrompt?.ai_prompt) {
            const customPrompt = titlePrompt.ai_prompt
              .replace('{{title}}', postData.title)
              .replace('{{description}}', postData.description)
              .replace('{{content}}', postData.content.substring(0, 3000))
              .replace('{{source_url}}', postData.source_url)
              .replace(/\{\{transaction_type\}\}/g, postData.transaction_type)
            titleResult = await callOpenAI(
              customPrompt,
              titlePrompt.max_tokens || 200,
              titlePrompt.temperature || 0.7
            )
          } else {
            titleResult = await AI_CALL.primaryArticleTitle(postData, newsletterId, 200, 0.7)
          }

          const headline = typeof titleResult === 'string'
            ? titleResult.trim()
            : (titleResult.raw || titleResult.headline || '').trim()

          if (!headline) {
            console.error(`[Module Titles] Failed to generate title for post ${post.id}`)
            return
          }

          const titleRefusal = detectAIRefusal(headline)
          if (titleRefusal) {
            console.error(`[Module Titles] AI returned refusal for post ${post.id} (matched: "${titleRefusal}"): ${headline.substring(0, 200)}`)
            return
          }

          const insertResult = await insertModuleArticle({
            post_id: post.id,
            issue_id: issueId,
            article_module_id: moduleId,
            headline: headline,
            content: '',
            rank: null,
            is_active: false,
            skipped: false,
            fact_check_score: null,
            fact_check_details: null,
            word_count: 0,
            ticker: (post as any).ticker || null,
            member_name: (post as any).member_name || null,
            transaction_type: (post as any).transaction_type || null,
            trade_image_url: (post as any).image_url || null,
            trade_image_alt: (post as any).image_alt || (post as any).ticker || null,
          })

          if (!insertResult.ok && !insertResult.duplicate) {
            console.error(`[Module Titles] Insert failed for post ${post.id}`)
          }

          console.log(`[Module Titles] Generated: "${headline.substring(0, 50)}..."`)

        } catch (error) {
          console.error(`[Module Titles] Failed for post ${post.id}:`, error instanceof Error ? error.message : 'Unknown')
        }
      }))

      if (i + BATCH_SIZE < postsWithRatings.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`[Module Titles] ✓ Generated titles for ${mod.name}`)
  }

  /**
   * Generate bodies for articles in a module
   */
  async generateBodiesForModule(issueId: string, moduleId: string, _offset: number = 0, limit: number = 3): Promise<void> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const mod = await ArticleModuleSelector.getModule(moduleId)
    if (!mod) {
      console.log(`[Module Bodies] Module ${moduleId} not found`)
      return
    }

    const { prompts } = await ArticleModuleSelector.getModulePrompts(moduleId)
    const bodyPrompt = prompts.find(p => p.prompt_type === 'article_body')

    const articles = await listArticlesNeedingBody(issueId, moduleId, limit)

    if (!articles || articles.length === 0) {
      console.log(`[Module Bodies] No articles awaiting body generation for ${mod.name}`)
      return
    }

    console.log(`[Module Bodies] Generating ${articles.length} bodies for ${mod.name}...`)

    const BATCH_SIZE = 2
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (article: any) => {
        try {
          const post = article.rss_posts
          if (!post) {
            console.error(`[Module Bodies] No RSS post for article ${article.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || '',
            transaction_type: normalizeTransactionType(post.transaction_type)
          }

          let bodyResult
          if (bodyPrompt?.ai_prompt) {
            const customPrompt = bodyPrompt.ai_prompt
              .replace('{{title}}', postData.title)
              .replace('{{headline}}', article.headline)
              .replace('{{description}}', postData.description)
              .replace('{{content}}', postData.content.substring(0, 5000))
              .replace('{{source_url}}', postData.source_url)
              .replace(/\{\{transaction_type\}\}/g, postData.transaction_type)
            const rawResult = await callOpenAI(
              customPrompt,
              bodyPrompt.max_tokens || 500,
              bodyPrompt.temperature || 0.7
            )
            if (typeof rawResult === 'string') {
              bodyResult = { content: rawResult.trim(), word_count: rawResult.split(/\s+/).length }
            } else if (rawResult.content) {
              bodyResult = rawResult
            } else if (rawResult.raw) {
              let extracted = false
              try {
                const parsed = JSON.parse(rawResult.raw)
                if (parsed && parsed.content) {
                  bodyResult = { content: parsed.content, word_count: parsed.word_count || parsed.content.split(/\s+/).length }
                  extracted = true
                }
              } catch {
                // not valid JSON, fall through
              }
              if (!extracted) {
                console.warn(`[Module Bodies] Could not extract content from raw AI response, using raw text`)
                bodyResult = { content: rawResult.raw, word_count: rawResult.raw.split(/\s+/).length }
              }
            } else {
              bodyResult = { content: '', word_count: 0 }
            }
          } else {
            bodyResult = await AI_CALL.primaryArticleBody(postData, newsletterId, article.headline, 500, 0.7)
          }

          if (!bodyResult.content || !bodyResult.word_count) {
            console.error(`[Module Bodies] Invalid body response for article ${article.id}`)
            return
          }

          // Safety check: if content looks like a JSON object, extract the content field
          if (bodyResult.content.trimStart().startsWith('{') && bodyResult.content.trimEnd().endsWith('}')) {
            try {
              const parsed = JSON.parse(bodyResult.content)
              if (parsed && typeof parsed.content === 'string') {
                console.warn(`[Module Bodies] Content was raw JSON for article ${article.id}, extracting content field`)
                bodyResult.content = parsed.content
                bodyResult.word_count = parsed.word_count || parsed.content.split(/\s+/).length
              }
            } catch {
              // Not valid JSON despite looking like it, use as-is
            }
          }

          const refusalMatch = detectAIRefusal(bodyResult.content)
          if (refusalMatch) {
            console.error(`[Module Bodies] AI returned refusal for article ${article.id} (matched: "${refusalMatch}"): ${bodyResult.content.substring(0, 200)}`)
            return
          }

          await updateModuleArticleContent(article.id, {
            content: bodyResult.content,
            wordCount: bodyResult.word_count,
          })

          console.log(`[Module Bodies] Generated body for article ${article.id} (${bodyResult.word_count} words)`)

        } catch (error) {
          console.error(`[Module Bodies] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')
        }
      }))

      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    console.log(`[Module Bodies] ✓ Generated bodies for ${mod.name}`)
  }

  /**
   * Fact-check articles for a module
   */
  async factCheckArticlesForModule(issueId: string, moduleId: string): Promise<void> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const mod = await ArticleModuleSelector.getModule(moduleId)
    if (!mod) {
      console.log(`[Module Fact-Check] Module ${moduleId} not found`)
      return
    }

    const articles = await listArticlesNeedingFactCheck(issueId, moduleId)

    if (!articles || articles.length === 0) {
      console.log(`[Module Fact-Check] No articles awaiting fact-check for ${mod.name}`)
      return
    }

    console.log(`[Module Fact-Check] Checking ${articles.length} articles for ${mod.name}...`)

    const BATCH_SIZE = 3
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (article: any) => {
        try {
          const post = article.rss_posts
          if (!post) {
            console.error(`[Module Fact-Check] No RSS post for article ${article.id}`)
            return
          }

          const originalContent = post.content || post.description || ''
          const factCheck = await this.articleGenerator.factCheckContent(article.content, originalContent, newsletterId)

          await updateModuleArticleFactCheck(article.id, {
            score: factCheck.score,
            details: factCheck.details,
          })

          console.log(`[Module Fact-Check] Article ${article.id}: Score ${factCheck.score}/10`)

        } catch (error) {
          console.error(`[Module Fact-Check] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')

          await updateModuleArticleFactCheck(article.id, {
            score: 0,
            details: `Fact-check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        }
      }))

      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`[Module Fact-Check] ✓ Checked articles for ${mod.name}`)
  }

  /**
   * Select top articles for a module and mark them as active
   */
  async selectTopArticlesForModule(issueId: string, moduleId: string): Promise<{ selected: number }> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')

    const mod = await ArticleModuleSelector.getModule(moduleId)
    if (!mod) {
      console.log(`[Module Select] Module ${moduleId} not found`)
      return { selected: 0 }
    }

    const limit = mod.articles_count || 3
    const result = await ArticleModuleSelector.activateTopArticles(issueId, moduleId, limit)

    console.log(`[Module Select] Activated ${result.activated} articles for ${mod.name}`)
    return { selected: result.activated }
  }

  /**
   * Get all active article modules for a publication
   */
  async getActiveArticleModules(publicationId: string): Promise<any[]> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')
    return ArticleModuleSelector.getActiveModules(publicationId)
  }
}
