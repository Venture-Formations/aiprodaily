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
 * Removes duplicate articles from a campaign, keeping only the best 6 per section
 * based on fact_check_score (or creation date if no scores exist)
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

    // Keep only top 6 primary articles
    if (primaryArticles && primaryArticles.length > 6) {
      const toDelete = primaryArticles.slice(6) // Everything after the first 6
      const deleteIds = toDelete.map(a => a.id)

      const { error: deleteError } = await supabaseAdmin
        .from('articles')
        .delete()
        .in('id', deleteIds)

      if (deleteError) {
        console.error('[Cleanup] Error deleting primary articles:', deleteError)
      } else {
        deletedPrimary = deleteIds.length
        console.log(`[Cleanup] Deleted ${deletedPrimary} duplicate primary articles`)
      }
    }

    // Keep only top 6 secondary articles
    if (secondaryArticles && secondaryArticles.length > 6) {
      const toDelete = secondaryArticles.slice(6) // Everything after the first 6
      const deleteIds = toDelete.map(a => a.id)

      const { error: deleteError } = await supabaseAdmin
        .from('secondary_articles')
        .delete()
        .in('id', deleteIds)

      if (deleteError) {
        console.error('[Cleanup] Error deleting secondary articles:', deleteError)
      } else {
        deletedSecondary = deleteIds.length
        console.log(`[Cleanup] Deleted ${deletedSecondary} duplicate secondary articles`)
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
