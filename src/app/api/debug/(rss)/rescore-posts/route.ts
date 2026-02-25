import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { callAIWithPrompt } from '@/lib/openai'

export const maxDuration = 600 // 10 minutes for rescoring

interface RssPost {
  id: string
  title: string
  description: string | null
  content: string | null
  full_article_text: string | null
  feed_id: string
}

interface CriteriaScore {
  score: number
  reason: string
  weight: number
}

/**
 * Re-score RSS posts that were ingested since a specific time
 *
 * Usage: GET /api/debug/rescore-posts?since=2025-12-17T03:00:00Z&dry_run=true&publication_id=XXX
 *
 * For 9pm CST yesterday, use since=YYYY-MM-DDT03:00:00Z (3am UTC = 9pm CST previous day)
 *
 * Parameters:
 * - since: ISO timestamp (required) - posts with processed_at >= this time will be rescored
 * - publication_id: UUID (required) - which publication to rescore
 * - section: 'primary' | 'secondary' (optional, default: 'primary')
 * - dry_run: boolean (optional, default: true) - if true, don't actually update
 * - limit: number (optional, default: 50) - max posts to process
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(rss)/rescore-posts' },
  async ({ request, logger }) => {
  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')
  const publicationId = searchParams.get('publication_id')
  const section = (searchParams.get('section') || 'primary') as 'primary' | 'secondary'
  const dryRun = searchParams.get('dry_run') !== 'false' // Default true
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  if (!since) {
    // Calculate default: 9pm CST yesterday = 3am UTC today
    const now = new Date()
    const yesterday9pmCST = new Date(now)
    yesterday9pmCST.setUTCHours(3, 0, 0, 0) // 3am UTC = 9pm CST
    if (now.getUTCHours() < 3) {
      // If it's before 3am UTC, go back one more day
      yesterday9pmCST.setUTCDate(yesterday9pmCST.getUTCDate() - 1)
    }

    return NextResponse.json({
      error: 'since parameter required',
      hint: 'Use ISO timestamp format, e.g.: since=' + yesterday9pmCST.toISOString(),
      example_for_9pm_cst_yesterday: yesterday9pmCST.toISOString()
    }, { status: 400 })
  }

  if (!publicationId) {
    return NextResponse.json({
      error: 'publication_id parameter required'
    }, { status: 400 })
  }

  try {
    console.log(`[RESCORE] ${dryRun ? 'DRY RUN:' : ''} Rescoring ${section} posts since ${since} for publication ${publicationId}`)

    // Get feeds for this section
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq('publication_id', publicationId)
      .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

    if (feedsError) {
      throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
    }

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: `No active ${section} feeds found`,
        posts_found: 0
      })
    }

    const feedIds = feeds.map(f => f.id)
    console.log(`[RESCORE] Found ${feedIds.length} ${section} feeds`)

    // Find posts to rescore
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, content, full_article_text, feed_id')
      .in('feed_id', feedIds)
      .gte('processed_at', since)
      .order('processed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`)
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No posts found matching criteria',
        since,
        publication_id: publicationId,
        section,
        posts_found: 0
      })
    }

    console.log(`[RESCORE] Found ${posts.length} posts to rescore`)

    // Fetch criteria configuration
    const enabledCountKey = section === 'primary' ? 'primary_criteria_enabled_count' : 'secondary_criteria_enabled_count'
    const criteriaPrefix = section === 'primary' ? 'criteria_' : 'secondary_criteria_'

    const { data: criteriaConfig, error: configError } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publicationId)
      .or(`key.eq.${enabledCountKey},key.eq.criteria_enabled_count,key.like.${criteriaPrefix}%_name,key.like.${criteriaPrefix}%_weight,key.like.criteria_%_name,key.like.criteria_%_weight`)

    if (configError) {
      throw new Error(`Failed to fetch criteria configuration: ${configError.message}`)
    }

    // Parse criteria configuration
    const enabledCountSetting = criteriaConfig?.find(s => s.key === enabledCountKey) ||
                                 criteriaConfig?.find(s => s.key === 'criteria_enabled_count')
    const enabledCount = enabledCountSetting?.value ? parseInt(enabledCountSetting.value) : 3

    const criteria: Array<{ number: number; name: string; weight: number }> = []
    for (let i = 1; i <= enabledCount; i++) {
      const nameSetting = criteriaConfig?.find(s => s.key === `${criteriaPrefix}${i}_name`) ||
                         criteriaConfig?.find(s => s.key === `criteria_${i}_name`)
      const weightSetting = criteriaConfig?.find(s => s.key === `${criteriaPrefix}${i}_weight`) ||
                           criteriaConfig?.find(s => s.key === `criteria_${i}_weight`)

      criteria.push({
        number: i,
        name: nameSetting?.value || `Criteria ${i}`,
        weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
      })
    }

    console.log(`[RESCORE] Using ${criteria.length} criteria: ${criteria.map(c => c.name).join(', ')}`)

    // Process posts
    let successCount = 0
    let errorCount = 0

    for (const post of posts) {
      console.log(`[RESCORE] Processing: ${post.title.substring(0, 60)}...`)

      try {
        // Evaluate post against each criterion
        const criteriaScores: CriteriaScore[] = []

        for (const criterion of criteria) {
          const fullText = post.full_article_text || post.content || post.description || ''
          const promptKey = `ai_prompt_criteria_${criterion.number}`

          const result = await callAIWithPrompt(promptKey, publicationId, {
            title: post.title,
            description: post.description || '',
            content: fullText
          })

          if (!result || typeof result !== 'object') {
            throw new Error(`Invalid AI response for criterion ${criterion.number}`)
          }

          const score = result.score
          const reason = result.reason || ''

          if (typeof score !== 'number' || score < 0 || score > 10) {
            throw new Error(`Criterion ${criterion.number} score must be between 0-10, got ${score}`)
          }

          criteriaScores.push({
            score,
            reason,
            weight: criterion.weight
          })
        }

        // Calculate weighted total score
        let totalWeightedScore = 0
        criteriaScores.forEach(({ score, weight }) => {
          totalWeightedScore += score * weight
        })

        // Build rating record
        const ratingRecord: Record<string, any> = {
          post_id: post.id,
          interest_level: criteriaScores[0]?.score || 0,
          local_relevance: criteriaScores[1]?.score || 0,
          community_impact: criteriaScores[2]?.score || 0,
          ai_reasoning: criteriaScores.map((c, i) => `${criteria[i]?.name}: ${c.reason}`).join('\n\n'),
          total_score: totalWeightedScore
        }

        // Add individual criteria scores
        for (let k = 0; k < criteriaScores.length && k < 5; k++) {
          const criterionNum = k + 1
          ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[k].score
          ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[k].reason
          ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[k].weight
        }

        if (!dryRun) {
          // Delete existing rating
          await supabaseAdmin
            .from('post_ratings')
            .delete()
            .eq('post_id', post.id)

          // Insert new rating
          const { error: insertError } = await supabaseAdmin
            .from('post_ratings')
            .insert([ratingRecord])

          if (insertError) {
            throw new Error(`Failed to insert rating: ${insertError.message}`)
          }
        }

        successCount++
        console.log(`[RESCORE] ${dryRun ? 'Would update' : 'Updated'} ${post.id}`)

        // Small delay between posts
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        errorCount++
        console.error(`[RESCORE] Error for ${post.id}:`, error instanceof Error ? error.message : 'Unknown error')
      }
    }

    console.log(`[RESCORE] Complete: ${successCount} succeeded, ${errorCount} failed`)

    return NextResponse.json({
      status: 'success',
      dry_run: dryRun,
      message: dryRun
        ? `DRY RUN: Would rescore ${successCount} posts`
        : `Rescored ${successCount} posts`,
      since,
      publication_id: publicationId,
      section,
      offset,
      next_offset: posts.length === limit ? offset + limit : null,
      total_posts: posts.length,
      succeeded: successCount,
      failed: errorCount
    })

  } catch (error) {
    console.error('[RESCORE] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
