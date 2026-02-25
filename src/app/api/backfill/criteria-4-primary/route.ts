import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { callAIWithPrompt } from '@/lib/openai'

/**
 * Backfill Criteria 4 Scores for Primary Feed
 * Re-evaluates posts from 24-60 hours ago with updated criteria 4
 * Updates total_score to reflect new criteria score
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'backfill/criteria-4-primary' },
  async ({ request, logger }) => {
    console.log('[Backfill C4 Primary] Endpoint called')

    const body = await request.json()
    const { newsletterId, dryRun = false, timeWindow = 'all' } = body

    if (!newsletterId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    // Validate timeWindow
    if (!['all', '24-36', '36-60'].includes(timeWindow)) {
      return NextResponse.json({
        error: 'Invalid timeWindow. Must be: all, 24-36, or 36-60'
      }, { status: 400 })
    }

    console.log(`[Backfill C4 Primary] Starting for newsletter: ${newsletterId}, timeWindow: ${timeWindow}, dryRun: ${dryRun}`)

    // Get time range based on window
    const now = new Date()
    let startHours: number
    let endHours: number

    if (timeWindow === 'all') {
      startHours = 60
      endHours = 24
    } else if (timeWindow === '24-36') {
      startHours = 36
      endHours = 24
    } else { // 36-60
      startHours = 60
      endHours = 36
    }

    const startTime = new Date(now.getTime() - (startHours * 60 * 60 * 1000))
    const endTime = new Date(now.getTime() - (endHours * 60 * 60 * 1000))

    console.log(`[Backfill C4 Primary] Time window: ${startTime.toISOString()} to ${endTime.toISOString()}`)

    // Get PRIMARY feeds only
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('publication_id', newsletterId)
      .eq('use_for_primary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      console.error('[Backfill C4 Primary] Error fetching primary feeds:', feedsError)
      return NextResponse.json({
        error: 'Failed to fetch primary feeds',
        details: feedsError?.message || 'No primary feeds found'
      }, { status: 500 })
    }

    const primaryFeedIds = feeds.map(f => f.id)
    console.log(`[Backfill C4 Primary] Found ${primaryFeedIds.length} primary feeds`)

    // Get posts from primary feeds in time window
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, content, full_article_text, processed_at')
      .in('feed_id', primaryFeedIds)
      .gte('processed_at', startTime.toISOString())
      .lte('processed_at', endTime.toISOString())

    if (postsError) {
      console.error('[Backfill C4 Primary] Error fetching posts:', postsError)
      return NextResponse.json({
        error: 'Failed to fetch posts',
        details: postsError?.message
      }, { status: 500 })
    }

    console.log(`[Backfill C4 Primary] Found ${posts?.length || 0} posts in time window`)

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts found in time window',
        stats: {
          total: 0,
          processed: 0,
          errors: 0,
          dryRun,
          timeWindow
        }
      })
    }

    // Get post_ratings for these posts
    const postIds = posts.map(p => p.id)
    const RATINGS_BATCH_SIZE = 100
    const allRatings: any[] = []

    for (let i = 0; i < postIds.length; i += RATINGS_BATCH_SIZE) {
      const batch = postIds.slice(i, i + RATINGS_BATCH_SIZE)
      const { data: batchRatings, error: ratingsError } = await supabaseAdmin
        .from('post_ratings')
        .select('*')
        .in('post_id', batch)

      if (ratingsError) {
        console.error('[Backfill C4 Primary] Error fetching ratings:', ratingsError)
        return NextResponse.json({
          error: 'Failed to fetch ratings',
          details: ratingsError?.message
        }, { status: 500 })
      }

      if (batchRatings) {
        allRatings.push(...batchRatings)
      }
    }

    console.log(`[Backfill C4 Primary] Found ${allRatings.length} ratings for ${postIds.length} posts`)

    // Create map of post_id to rating
    const ratingsMap = new Map()
    allRatings.forEach(rating => {
      ratingsMap.set(rating.post_id, rating)
    })

    // Filter to posts that have ratings
    const postsWithRatings = posts.filter(post => ratingsMap.has(post.id))
    console.log(`[Backfill C4 Primary] ${postsWithRatings.length} posts have ratings`)

    // Get criteria weights
    const { data: weightSettings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('publication_id', newsletterId)
      .in('key', [
        'criteria_1_weight',
        'criteria_2_weight',
        'criteria_3_weight',
        'criteria_4_weight',
        'criteria_5_weight'
      ])

    const weights = {
      c1: 1.0,
      c2: 1.0,
      c3: 1.0,
      c4: 1.0,
      c5: 1.0
    }

    weightSettings?.forEach(setting => {
      const weight = parseFloat(setting.value)
      if (setting.key === 'criteria_1_weight') weights.c1 = weight
      else if (setting.key === 'criteria_2_weight') weights.c2 = weight
      else if (setting.key === 'criteria_3_weight') weights.c3 = weight
      else if (setting.key === 'criteria_4_weight') weights.c4 = weight
      else if (setting.key === 'criteria_5_weight') weights.c5 = weight
    })

    console.log(`[Backfill C4 Primary] Weights:`, weights)

    let processed = 0
    let errors = 0

    const BATCH_SIZE = 3
    const BATCH_DELAY = 2000

    for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
      const batch = postsWithRatings.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (post: any) => {
        try {
          const rating = ratingsMap.get(post.id)
          if (!rating) {
            console.log(`[Backfill C4 Primary] Skipping post ${post.id} - no rating`)
            return
          }

          // Prepare post data
          const postData = {
            title: post.title,
            description: post.description || '',
            content: post.full_article_text || post.content || post.description || ''
          }

          // Call AI prompt for criteria 4
          const result = await callAIWithPrompt(
            'ai_prompt_criteria_4',
            newsletterId,
            postData
          )

          if (!result || typeof result.score !== 'number') {
            console.error(`[Backfill C4 Primary] Invalid AI response for post ${post.id}:`, result)
            errors++
            return
          }

          const newScore = result.score
          const newReason = result.reason || ''

          // Calculate new total score
          const c1 = (rating.criteria_1_score || 0) * weights.c1
          const c2 = (rating.criteria_2_score || 0) * weights.c2
          const c3 = (rating.criteria_3_score || 0) * weights.c3
          const c4 = newScore * weights.c4
          const c5 = (rating.criteria_5_score || 0) * weights.c5

          const newTotalScore = c1 + c2 + c3 + c4 + c5

          console.log(`[Backfill C4 Primary] Post ${post.id.substring(0, 8)}: C4 = ${newScore}, Total = ${newTotalScore.toFixed(1)} (was ${rating.total_score})`)

          if (!dryRun) {
            // Update rating with new criteria 4 score
            const updateData: any = {
              criteria_4_score: newScore,
              criteria_4_weight: weights.c4,
              criteria_4_reason: newReason,
              total_score: newTotalScore
            }

            const { error: updateError } = await supabaseAdmin
              .from('post_ratings')
              .update(updateData)
              .eq('id', rating.id)

            if (updateError) {
              console.error(`[Backfill C4 Primary] Error updating rating for post ${post.id}:`, updateError)
              errors++
              return
            }
          }

          processed++

        } catch (error) {
          console.error(`[Backfill C4 Primary] Error processing post ${post.id}:`, error)
          errors++
        }
      }))

      // Delay between batches
      if (i + BATCH_SIZE < postsWithRatings.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }

      // Progress update
      if ((i + BATCH_SIZE) % 15 === 0) {
        console.log(`[Backfill C4 Primary] Progress: ${Math.min(i + BATCH_SIZE, postsWithRatings.length)}/${postsWithRatings.length}`)
      }
    }

    console.log(`[Backfill C4 Primary] Complete: processed=${processed}, errors=${errors}`)

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Backfill completed',
      stats: {
        totalPosts: posts.length,
        postsWithRatings: postsWithRatings.length,
        processed,
        errors,
        dryRun,
        timeWindow
      }
    })
  }
)

export const maxDuration = 600 // 10 minutes
