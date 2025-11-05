import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { callAIWithPrompt } from '@/lib/openai'

/**
 * Backfill Criteria 4 Scores
 * Re-evaluates all posts from the last 36 days with criteria 4
 * and updates total_score to include the new criteria
 */
export async function POST(request: NextRequest) {
  try {
    // Check auth: either session or CRON_SECRET
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (!session && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { newsletterId, dryRun = false } = body

    if (!newsletterId) {
      return NextResponse.json({ error: 'newsletter_id required' }, { status: 400 })
    }

    console.log(`[Backfill] Starting criteria 4 backfill for newsletter: ${newsletterId}`)
    console.log(`[Backfill] Dry run: ${dryRun}`)

    // Get posts from last 36 days
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - 36)
    const lookbackTimestamp = lookbackDate.toISOString()

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        content,
        full_article_text,
        post_ratings(
          id,
          criteria_1_score,
          criteria_1_weight,
          criteria_2_score,
          criteria_2_weight,
          criteria_3_score,
          criteria_3_weight,
          criteria_4_score,
          criteria_4_weight,
          criteria_5_score,
          criteria_5_weight,
          total_score
        )
      `)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    if (postsError || !posts) {
      console.error('[Backfill] Error fetching posts:', postsError)
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    console.log(`[Backfill] Found ${posts.length} posts with ratings from last 36 days`)

    // Get criteria 4 weight setting
    const { data: weightSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('newsletter_id', newsletterId)
      .eq('key', 'criteria_4_weight')
      .single()

    const criteria4Weight = weightSetting?.value ? parseFloat(weightSetting.value) : 1.0

    console.log(`[Backfill] Criteria 4 weight: ${criteria4Weight}`)

    let processed = 0
    let skipped = 0
    let errors = 0

    // Process posts in batches of 3 with delays
    const BATCH_SIZE = 3
    const BATCH_DELAY = 2000

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (post: any) => {
        try {
          const rating = post.post_ratings?.[0]
          if (!rating) {
            console.log(`[Backfill] Skipping post ${post.id} - no rating found`)
            skipped++
            return
          }

          // Skip if already has criteria 4 score
          if (rating.criteria_4_score !== null && rating.criteria_4_score !== undefined) {
            console.log(`[Backfill] Skipping post ${post.id} - already has criteria 4 score`)
            skipped++
            return
          }

          // Prepare post data for AI evaluation
          const postData = {
            title: post.title,
            description: post.description || '',
            content: post.full_article_text || post.content || post.description || ''
          }

          // Call criteria 4 AI prompt
          const result = await callAIWithPrompt(
            'ai_prompt_criteria_4',
            newsletterId,
            postData
          )

          if (!result || typeof result.score !== 'number') {
            console.error(`[Backfill] Invalid AI response for post ${post.id}:`, result)
            errors++
            return
          }

          const criteria4Score = result.score
          const criteria4Reason = result.reason || ''

          // Calculate new total score
          const c1 = (rating.criteria_1_score || 0) * (rating.criteria_1_weight || 1)
          const c2 = (rating.criteria_2_score || 0) * (rating.criteria_2_weight || 1)
          const c3 = (rating.criteria_3_score || 0) * (rating.criteria_3_weight || 1)
          const c4 = criteria4Score * criteria4Weight
          const c5 = (rating.criteria_5_score || 0) * (rating.criteria_5_weight || 1)

          const newTotalScore = c1 + c2 + c3 + c4 + c5

          console.log(`[Backfill] Post ${post.id}: Criteria 4 = ${criteria4Score}, New total = ${newTotalScore} (was ${rating.total_score})`)

          if (!dryRun) {
            // Update post_ratings with criteria 4 score and new total
            const { error: updateError } = await supabaseAdmin
              .from('post_ratings')
              .update({
                criteria_4_score: criteria4Score,
                criteria_4_weight: criteria4Weight,
                criteria_4_reason: criteria4Reason,
                total_score: newTotalScore,
                updated_at: new Date().toISOString()
              })
              .eq('id', rating.id)

            if (updateError) {
              console.error(`[Backfill] Error updating rating for post ${post.id}:`, updateError)
              errors++
              return
            }
          }

          processed++

        } catch (error) {
          console.error(`[Backfill] Error processing post ${post.id}:`, error)
          errors++
        }
      }))

      // Delay between batches
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }

      // Progress update every 10 posts
      if ((i + BATCH_SIZE) % 10 === 0) {
        console.log(`[Backfill] Progress: ${Math.min(i + BATCH_SIZE, posts.length)}/${posts.length} posts processed`)
      }
    }

    console.log(`[Backfill] Complete: ${processed} updated, ${skipped} skipped, ${errors} errors`)

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Backfill completed',
      stats: {
        total: posts.length,
        processed,
        skipped,
        errors,
        dryRun
      }
    })

  } catch (error) {
    console.error('[Backfill] Failed:', error)
    return NextResponse.json({
      error: 'Backfill failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 600 // 10 minutes
