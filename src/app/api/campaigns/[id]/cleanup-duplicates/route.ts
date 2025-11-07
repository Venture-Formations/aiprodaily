import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Cleanup Duplicate Articles
 *
 * Removes duplicate articles from a campaign:
 * 1. Identifies articles with the same post_id (true duplicates)
 * 2. Keeps the first occurrence (highest fact_check_score, earliest created_at)
 * 3. Deletes subsequent duplicates
 * 4. If more than 6 unique articles remain, trims to top 6
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    console.log(`[Cleanup] Starting duplicate cleanup for campaign: ${campaignId}`)

    // Get all primary articles for this campaign
    const { data: primaryArticles } = await supabaseAdmin
      .from('articles')
      .select('id, headline, fact_check_score, created_at, post_id')
      .eq('campaign_id', campaignId)
      .order('fact_check_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })

    // Get all secondary articles for this campaign
    const { data: secondaryArticles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, headline, fact_check_score, created_at, post_id')
      .eq('campaign_id', campaignId)
      .order('fact_check_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })

    let deletedPrimary = 0
    let deletedSecondary = 0
    const duplicatesFound: { primary: string[], secondary: string[] } = { primary: [], secondary: [] }

    // Remove duplicate PRIMARY articles (same post_id)
    if (primaryArticles && primaryArticles.length > 0) {
      const seenPostIds = new Set<string>()
      const toDelete: string[] = []

      for (const article of primaryArticles) {
        if (seenPostIds.has(article.post_id)) {
          // This is a duplicate - mark for deletion
          toDelete.push(article.id)
          duplicatesFound.primary.push(article.post_id)
          console.log(`[Cleanup] Found duplicate primary article: ${article.id} (post_id: ${article.post_id})`)
        } else {
          // First occurrence - keep it
          seenPostIds.add(article.post_id)
        }
      }

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('articles')
          .delete()
          .in('id', toDelete)

        if (deleteError) {
          console.error('[Cleanup] Error deleting primary articles:', deleteError)
        } else {
          deletedPrimary = toDelete.length
          console.log(`[Cleanup] Deleted ${deletedPrimary} duplicate primary articles`)
        }
      }

      // After removing duplicates, check if we still have more than 6 and trim
      const remaining = primaryArticles.length - deletedPrimary
      if (remaining > 6) {
        const keepCount = 6
        const trimCount = remaining - keepCount

        // Get articles to trim (lowest scores, keeping unique post_ids)
        const keptArticles = primaryArticles.filter(a => !toDelete.includes(a.id))
        const toTrim = keptArticles.slice(keepCount).map(a => a.id)

        if (toTrim.length > 0) {
          const { error: trimError } = await supabaseAdmin
            .from('articles')
            .delete()
            .in('id', toTrim)

          if (!trimError) {
            deletedPrimary += toTrim.length
            console.log(`[Cleanup] Trimmed ${toTrim.length} extra primary articles`)
          }
        }
      }
    }

    // Remove duplicate SECONDARY articles (same post_id)
    if (secondaryArticles && secondaryArticles.length > 0) {
      const seenPostIds = new Set<string>()
      const toDelete: string[] = []

      for (const article of secondaryArticles) {
        if (seenPostIds.has(article.post_id)) {
          // This is a duplicate - mark for deletion
          toDelete.push(article.id)
          duplicatesFound.secondary.push(article.post_id)
          console.log(`[Cleanup] Found duplicate secondary article: ${article.id} (post_id: ${article.post_id})`)
        } else {
          // First occurrence - keep it
          seenPostIds.add(article.post_id)
        }
      }

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('secondary_articles')
          .delete()
          .in('id', toDelete)

        if (deleteError) {
          console.error('[Cleanup] Error deleting secondary articles:', deleteError)
        } else {
          deletedSecondary = toDelete.length
          console.log(`[Cleanup] Deleted ${deletedSecondary} duplicate secondary articles`)
        }
      }

      // After removing duplicates, check if we still have more than 6 and trim
      const remaining = secondaryArticles.length - deletedSecondary
      if (remaining > 6) {
        const keepCount = 6
        const trimCount = remaining - keepCount

        // Get articles to trim (lowest scores, keeping unique post_ids)
        const keptArticles = secondaryArticles.filter(a => !toDelete.includes(a.id))
        const toTrim = keptArticles.slice(keepCount).map(a => a.id)

        if (toTrim.length > 0) {
          const { error: trimError } = await supabaseAdmin
            .from('secondary_articles')
            .delete()
            .in('id', toTrim)

          if (!trimError) {
            deletedSecondary += toTrim.length
            console.log(`[Cleanup] Trimmed ${toTrim.length} extra secondary articles`)
          }
        }
      }
    }

    // Log activity
    if (session.user?.email && (deletedPrimary > 0 || deletedSecondary > 0)) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            campaign_id: campaignId,
            action: 'duplicates_cleaned',
            details: {
              primary_deleted: deletedPrimary,
              secondary_deleted: deletedSecondary
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      deletedPrimary,
      deletedSecondary,
      duplicatesFound: {
        primaryCount: duplicatesFound.primary.length,
        secondaryCount: duplicatesFound.secondary.length,
        primaryPostIds: Array.from(new Set(duplicatesFound.primary)),
        secondaryPostIds: Array.from(new Set(duplicatesFound.secondary))
      },
      remainingPrimary: (primaryArticles?.length || 0) - deletedPrimary,
      remainingSecondary: (secondaryArticles?.length || 0) - deletedSecondary,
      message: `Cleaned up ${deletedPrimary} primary and ${deletedSecondary} secondary duplicate articles`
    })

  } catch (error) {
    console.error('[Cleanup] Failed to cleanup duplicates:', error)
    return NextResponse.json({
      error: 'Failed to cleanup duplicates',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
