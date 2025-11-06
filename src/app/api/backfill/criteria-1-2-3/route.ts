import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { callAIWithPrompt } from '@/lib/openai'

/**
 * Backfill Criteria 1-3 Scores for Primary Feed
 * Re-evaluates posts from 6-36 hours ago with updated criteria 1, 2, and 3
 * Updates total_score to reflect new criteria scores
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Backfill C1-3] Endpoint called')

    // Check auth: either session or CRON_SECRET
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (!session && secret !== process.env.CRON_SECRET) {
      console.log('[Backfill C1-3] Auth failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newsletterId, dryRun = false, timeWindow = 'all' } = body

    if (!newsletterId) {
      return NextResponse.json({ error: 'newsletter_id required' }, { status: 400 })
    }

    // Validate timeWindow
    if (!['all', '6-24', '24-36', '36-60'].includes(timeWindow)) {
      return NextResponse.json({
        error: 'Invalid timeWindow. Must be: all, 6-24, 24-36, or 36-60'
      }, { status: 400 })
    }

    console.log(`[Backfill C1-3] Starting for newsletter: ${newsletterId}, timeWindow: ${timeWindow}, dryRun: ${dryRun}`)

    // Get time range based on window
    const now = new Date()
    let startHours: number
    let endHours: number

    if (timeWindow === 'all') {
      startHours = 36
      endHours = 6
    } else if (timeWindow === '6-24') {
      startHours = 24
      endHours = 6
    } else if (timeWindow === '24-36') {
      startHours = 36
      endHours = 24
    } else { // 36-60
      startHours = 60
      endHours = 36
    }

    const startTime = new Date(now.getTime() - (startHours * 60 * 60 * 1000))
    const endTime = new Date(now.getTime() - (endHours * 60 * 60 * 1000))

    console.log(`[Backfill C1-3] Time window: ${startTime.toISOString()} to ${endTime.toISOString()}`)

    // Get PRIMARY feeds only
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('newsletter_id', newsletterId)
      .eq('use_for_primary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      console.error('[Backfill C1-3] Error fetching primary feeds:', feedsError)
      return NextResponse.json({
        error: 'Failed to fetch primary feeds',
        details: feedsError?.message || 'No primary feeds found'
      }, { status: 500 })
    }

    const primaryFeedIds = feeds.map(f => f.id)
    console.log(`[Backfill C1-3] Found ${primaryFeedIds.length} primary feeds`)

    // Get posts from primary feeds in time window
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, content, full_article_text, processed_at')
      .in('feed_id', primaryFeedIds)
      .gte('processed_at', startTime.toISOString())
      .lte('processed_at', endTime.toISOString())

    if (postsError) {
      console.error('[Backfill C1-3] Error fetching posts:', postsError)
      return NextResponse.json({
        error: 'Failed to fetch posts',
        details: postsError?.message
      }, { status: 500 })
    }

    console.log(`[Backfill C1-3] Found ${posts?.length || 0} posts in time window`)

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts found in time window',
        stats: {
          total: 0,
          criteria1: 0,
          criteria2: 0,
          criteria3: 0,
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
        console.error('[Backfill C1-3] Error fetching ratings:', ratingsError)
        return NextResponse.json({
          error: 'Failed to fetch ratings',
          details: ratingsError?.message
        }, { status: 500 })
      }

      if (batchRatings) {
        allRatings.push(...batchRatings)
      }
    }

    console.log(`[Backfill C1-3] Found ${allRatings.length} ratings for ${postIds.length} posts`)

    // Create map of post_id to rating
    const ratingsMap = new Map()
    allRatings.forEach(rating => {
      ratingsMap.set(rating.post_id, rating)
    })

    // Filter to posts that have ratings
    const postsWithRatings = posts.filter(post => ratingsMap.has(post.id))
    console.log(`[Backfill C1-3] ${postsWithRatings.length} posts have ratings`)

    // Get criteria weights
    const { data: weightSettings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('newsletter_id', newsletterId)
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

    console.log(`[Backfill C1-3] Weights:`, weights)

    let criteria1Updated = 0
    let criteria2Updated = 0
    let criteria3Updated = 0
    let errors = 0

    const BATCH_SIZE = 3
    const BATCH_DELAY = 2000

    // Process each criteria sequentially
    for (const criteriaNum of [1, 2, 3]) {
      console.log(`[Backfill C1-3] Processing criteria ${criteriaNum}...`)

      for (let i = 0; i < postsWithRatings.length; i += BATCH_SIZE) {
        const batch = postsWithRatings.slice(i, i + BATCH_SIZE)

        await Promise.all(batch.map(async (post: any) => {
          try {
            const rating = ratingsMap.get(post.id)
            if (!rating) {
              console.log(`[Backfill C1-3] Skipping post ${post.id} - no rating`)
              return
            }

            // Prepare post data
            const postData = {
              title: post.title,
              description: post.description || '',
              content: post.full_article_text || post.content || post.description || ''
            }

            // Call AI prompt for this criteria
            const result = await callAIWithPrompt(
              `ai_prompt_criteria_${criteriaNum}`,
              newsletterId,
              postData
            )

            if (!result || typeof result.score !== 'number') {
              console.error(`[Backfill C1-3] Invalid AI response for post ${post.id}, criteria ${criteriaNum}:`, result)
              errors++
              return
            }

            const newScore = result.score
            const newReason = result.reason || ''

            // Calculate new total score
            const c1 = criteriaNum === 1 ? newScore * weights.c1 : (rating.criteria_1_score || 0) * weights.c1
            const c2 = criteriaNum === 2 ? newScore * weights.c2 : (rating.criteria_2_score || 0) * weights.c2
            const c3 = criteriaNum === 3 ? newScore * weights.c3 : (rating.criteria_3_score || 0) * weights.c3
            const c4 = (rating.criteria_4_score || 0) * weights.c4
            const c5 = (rating.criteria_5_score || 0) * weights.c5

            const newTotalScore = c1 + c2 + c3 + c4 + c5

            console.log(`[Backfill C1-3] Post ${post.id.substring(0, 8)}: C${criteriaNum} = ${newScore}, Total = ${newTotalScore.toFixed(1)} (was ${rating.total_score})`)

            if (!dryRun) {
              // Update rating with new criteria score
              const updateData: any = {
                [`criteria_${criteriaNum}_score`]: newScore,
                [`criteria_${criteriaNum}_weight`]: weights[`c${criteriaNum}` as keyof typeof weights],
                [`criteria_${criteriaNum}_reason`]: newReason,
                total_score: newTotalScore
              }

              const { error: updateError } = await supabaseAdmin
                .from('post_ratings')
                .update(updateData)
                .eq('id', rating.id)

              if (updateError) {
                console.error(`[Backfill C1-3] Error updating rating for post ${post.id}:`, updateError)
                errors++
                return
              }
            }

            // Track success
            if (criteriaNum === 1) criteria1Updated++
            else if (criteriaNum === 2) criteria2Updated++
            else if (criteriaNum === 3) criteria3Updated++

          } catch (error) {
            console.error(`[Backfill C1-3] Error processing post ${post.id}, criteria ${criteriaNum}:`, error)
            errors++
          }
        }))

        // Delay between batches
        if (i + BATCH_SIZE < postsWithRatings.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
        }

        // Progress update
        if ((i + BATCH_SIZE) % 15 === 0) {
          console.log(`[Backfill C1-3] Criteria ${criteriaNum} progress: ${Math.min(i + BATCH_SIZE, postsWithRatings.length)}/${postsWithRatings.length}`)
        }
      }

      console.log(`[Backfill C1-3] Criteria ${criteriaNum} complete`)
    }

    console.log(`[Backfill C1-3] All criteria complete: C1=${criteria1Updated}, C2=${criteria2Updated}, C3=${criteria3Updated}, errors=${errors}`)

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Backfill completed',
      stats: {
        totalPosts: posts.length,
        postsWithRatings: postsWithRatings.length,
        criteria1Updated,
        criteria2Updated,
        criteria3Updated,
        errors,
        dryRun,
        timeWindow
      }
    })

  } catch (error) {
    console.error('[Backfill C1-3] CRITICAL ERROR:', error)
    console.error('[Backfill C1-3] Error stack:', error instanceof Error ? error.stack : 'No stack')

    return NextResponse.json({
      error: 'Backfill failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error)
    }, { status: 500 })
  }
}

export const maxDuration = 600 // 10 minutes
