import { supabaseAdmin } from '../supabase'
import { callWithStructuredPrompt } from '../openai'
import type { RssPost, ContentEvaluation } from '@/types/database'
import { getNewsletterIdFromIssue } from './shared-context'

/**
 * Post scoring and evaluation module.
 * Evaluates posts against configured criteria using AI.
 */
export class Scoring {
  /**
   * Score/evaluate posts for a section - used by step-based processing
   */
  async scorePostsForSection(issueId: string, section: 'primary' | 'secondary' = 'primary') {
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    // Get feeds for this section
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return { scored: 0, errors: 0 }
    }

    const feedIds = feeds.map(f => f.id)

    // Get posts for this issue from feeds in this section
    // Limit to 12 most recent posts (processing sequentially to handle full article text)
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('issue_id', issueId)
      .in('feed_id', feedIds)
      .order('processed_at', { ascending: false })
      .limit(12)

    if (error || !posts) {
      throw new Error(`Failed to fetch ${section} posts for scoring`)
    }

    // Evaluate posts in batches
    const BATCH_SIZE = 3
    let successCount = 0
    let errorCount = 0
    const totalBatches = Math.ceil(posts.length / BATCH_SIZE)

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      let batchSuccess = 0
      let batchErrors = 0

      // Process posts sequentially (not in parallel) to avoid memory issues with full article text
      for (let j = 0; j < batch.length; j++) {
        const post = batch[j]
        try {
          const evaluation = await this.evaluatePost(post, newsletterId, section)

          if (typeof evaluation.interest_level !== 'number' ||
              typeof evaluation.local_relevance !== 'number' ||
              typeof evaluation.community_impact !== 'number') {
            throw new Error(`Invalid score types returned by AI`)
          }

          const ratingRecord: any = {
            post_id: post.id,
            interest_level: evaluation.interest_level,
            local_relevance: evaluation.local_relevance,
            community_impact: evaluation.community_impact,
            ai_reasoning: evaluation.reasoning,
            total_score: (evaluation as any).total_score || ((evaluation.interest_level + evaluation.local_relevance + evaluation.community_impact) / 30 * 100)
          }

          const criteriaScores = (evaluation as any).criteria_scores
          if (criteriaScores && Array.isArray(criteriaScores)) {
            for (let k = 0; k < criteriaScores.length && k < 5; k++) {
              const criterionNum = k + 1
              ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[k].score
              ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[k].reason
              ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[k].weight
            }
          }

          const { error: ratingError } = await supabaseAdmin
            .from('post_ratings')
            .insert([ratingRecord])

          if (ratingError) {
            throw new Error(`Rating insert failed: ${ratingError.message}`)
          }

          successCount++
          batchSuccess++

        } catch (error) {
          errorCount++
          batchErrors++
        }
      }

      // Log batch completion
      console.log(`[Score] Batch ${batchNum}/${totalBatches} (${section}): ${batchSuccess} succeeded, ${batchErrors} failed`)

      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    return { scored: successCount, errors: errorCount }
  }

  /**
   * Evaluate a single post against module criteria using AI
   */
  async evaluatePost(post: RssPost, newsletterId: string, section: 'primary' | 'secondary' = 'primary', moduleId?: string | null): Promise<ContentEvaluation> {
    // moduleId is required - all scoring uses article_module_criteria
    if (!moduleId) {
      throw new Error('moduleId is required for scoring - all posts must be assigned to an article mod')
    }

    const { data: moduleCriteria, error: moduleError } = await supabaseAdmin
      .from('article_module_criteria')
      .select('criteria_number, name, weight, ai_prompt, is_active')
      .eq('article_module_id', moduleId)
      .eq('is_active', true)
      .order('criteria_number', { ascending: true })

    if (moduleError) {
      console.error(`[Score] Failed to fetch criteria for mod ${moduleId}:`, moduleError)
      throw new Error(`Failed to fetch criteria for mod ${moduleId}`)
    }

    if (!moduleCriteria || moduleCriteria.length === 0) {
      throw new Error(`No active criteria found for mod ${moduleId}`)
    }

    const criteria = moduleCriteria.map(c => ({
      number: c.criteria_number,
      name: c.name,
      weight: c.weight,
      ai_prompt: c.ai_prompt
    }))

    console.log(`[Score] Using ${criteria.length} criteria from mod ${moduleId}`)

    // Evaluate post against each enabled criterion
    const criteriaScores: Array<{ score: number; reason: string; weight: number }> = []

    for (const criterion of criteria) {
      try {
        const fullText = post.full_article_text || post.content || post.description || ''

        if (!criterion.ai_prompt) {
          throw new Error(`Criterion ${criterion.number} (${criterion.name}) has no ai_prompt configured`)
        }

        const promptConfig = JSON.parse(criterion.ai_prompt)
        const model = promptConfig.model || 'gpt-4o'
        const provider: 'openai' | 'claude' = model.toLowerCase().includes('claude') ? 'claude' : 'openai'

        const result = await callWithStructuredPrompt(
          promptConfig,
          {
            title: post.title,
            description: post.description || '',
            content: fullText
          },
          provider,
          `module_criteria_${criterion.number}`
        )

        if (!result || typeof result !== 'object') {
          throw new Error(`Invalid AI response type for criterion ${criterion.number}: expected object, got ${typeof result}`)
        }

        const score = result.score
        const reason = result.reason || ''

        if (typeof score !== 'number' || score < 0 || score > 10) {
          throw new Error(`Criterion ${criterion.number} score must be between 0-10, got ${score} (type: ${typeof score})`)
        }

        criteriaScores.push({
          score,
          reason,
          weight: criterion.weight
        })

      } catch (error) {
        throw error
      }
    }

    // Calculate weighted total score
    let totalWeightedScore = 0
    let totalWeight = 0

    criteriaScores.forEach(({ score, weight }) => {
      totalWeightedScore += score * weight
      totalWeight += weight
    })

    // Return evaluation in legacy format for backward compatibility
    return {
      interest_level: criteriaScores[0]?.score || 0,
      local_relevance: criteriaScores[1]?.score || 0,
      community_impact: criteriaScores[2]?.score || 0,
      reasoning: criteriaScores.map((c, i) => `${criteria[i]?.name}: ${c.reason}`).join('\n\n'),
      criteria_scores: criteriaScores,
      total_score: totalWeightedScore
    } as any
  }
}
