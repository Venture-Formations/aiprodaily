import { supabaseAdmin } from '../supabase'
import { AI_CALL, callOpenAI } from '../openai'
import { detectAIRefusal, getNewsletterIdFromIssue } from './shared-context'
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
    const postsToAssign = articlesNeeded * 4

    const { data: topPosts } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        post_ratings(
          total_score,
          criteria_1_score,
          criteria_2_score,
          criteria_3_score,
          criteria_4_score,
          criteria_5_score
        )
      `)
      .in('feed_id', feedIds)
      .is('issue_id', null)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    if (!topPosts || topPosts.length === 0) {
      console.log(`[Module] No available posts for mod ${mod.name}`)
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

    const sortedPosts = eligiblePosts
      .sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, postsToAssign)

    if (sortedPosts.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({
          issue_id: issueId,
          article_module_id: moduleId
        })
        .in('id', sortedPosts.map((p: any) => p.id))
    }

    console.log(`[Module] Assigned ${sortedPosts.length} posts to mod ${mod.name}${filteredCount > 0 ? ` (${filteredCount} filtered by minimum scores)` : ''}`)
    return { assigned: sortedPosts.length, filtered: filteredCount }
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

    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('*, post_ratings(*)')
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .in('feed_id', feedIds)

    if (!posts || posts.length === 0) {
      console.log(`[Module Titles] No posts assigned to mod ${mod.name}`)
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

      await Promise.all(batch.map(async (post) => {
        try {
          const { data: existing } = await supabaseAdmin
            .from('module_articles')
            .select('id')
            .eq('post_id', post.id)
            .eq('issue_id', issueId)
            .eq('article_module_id', moduleId)
            .maybeSingle()

          if (existing) {
            console.log(`[Module Titles] Article already exists for post ${post.id}`)
            return
          }

          const fullText = post.full_article_text || post.content || post.description || ''
          const postData = {
            title: post.title,
            description: post.description || '',
            content: fullText,
            source_url: post.source_url || ''
          }

          let titleResult
          if (titlePrompt?.ai_prompt) {
            const customPrompt = titlePrompt.ai_prompt
              .replace('{{title}}', postData.title)
              .replace('{{description}}', postData.description)
              .replace('{{content}}', postData.content.substring(0, 3000))
              .replace('{{source_url}}', postData.source_url)
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

          const { error: insertError } = await supabaseAdmin
            .from('module_articles')
            .insert([{
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
              word_count: 0
            }])

          if (insertError && insertError.code !== '23505') {
            console.error(`[Module Titles] Insert failed for post ${post.id}:`, insertError.message)
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
  async generateBodiesForModule(issueId: string, moduleId: string, offset: number = 0, limit: number = 3): Promise<void> {
    const { ArticleModuleSelector } = await import('@/lib/article-modules')
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const mod = await ArticleModuleSelector.getModule(moduleId)
    if (!mod) {
      console.log(`[Module Bodies] Module ${moduleId} not found`)
      return
    }

    const { prompts } = await ArticleModuleSelector.getModulePrompts(moduleId)
    const bodyPrompt = prompts.find(p => p.prompt_type === 'article_body')

    const { data: articles } = await supabaseAdmin
      .from('module_articles')
      .select('*, rss_posts(*)')
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .eq('content', '')
      .not('headline', 'is', null)
      .order('post_id', { ascending: true })
      .limit(limit)

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
            source_url: post.source_url || ''
          }

          let bodyResult
          if (bodyPrompt?.ai_prompt) {
            const customPrompt = bodyPrompt.ai_prompt
              .replace('{{title}}', postData.title)
              .replace('{{headline}}', article.headline)
              .replace('{{description}}', postData.description)
              .replace('{{content}}', postData.content.substring(0, 5000))
              .replace('{{source_url}}', postData.source_url)
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

          await supabaseAdmin
            .from('module_articles')
            .update({
              content: bodyResult.content,
              word_count: bodyResult.word_count
            })
            .eq('id', article.id)

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

    const { data: articles } = await supabaseAdmin
      .from('module_articles')
      .select('*, rss_posts(*)')
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .neq('content', '')
      .not('content', 'is', null)
      .is('fact_check_score', null)

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

          await supabaseAdmin
            .from('module_articles')
            .update({
              fact_check_score: factCheck.score,
              fact_check_details: factCheck.details
            })
            .eq('id', article.id)

          console.log(`[Module Fact-Check] Article ${article.id}: Score ${factCheck.score}/10`)

        } catch (error) {
          console.error(`[Module Fact-Check] Failed for article ${article.id}:`, error instanceof Error ? error.message : 'Unknown')

          await supabaseAdmin
            .from('module_articles')
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
