import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ArchiveService } from '@/lib/archive-service'
import { ErrorHandler } from '@/lib/error-handler'

/**
 * Step 1: Archive old campaign data and clear previous articles/posts
 * This is the first step in the RSS processing chain
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 1/7] Starting: Archive old data for campaign ${campaign_id}`)

    const archiveService = new ArchiveService()
    const errorHandler = new ErrorHandler()

    // Archive existing articles and posts before clearing (PRESERVES POSITION DATA!)
    console.log('Archiving existing articles and posts before clearing...')

    try {
      const archiveResult = await archiveService.archiveCampaignArticles(campaign_id, 'rss_processing_clear')
      console.log(`✅ Archive successful: ${archiveResult.archivedArticlesCount} articles, ${archiveResult.archivedPostsCount} posts, ${archiveResult.archivedRatingsCount} ratings preserved`)

      // Log specifically about position data preservation
      if (archiveResult.archivedArticlesCount > 0) {
        const { data: articlesWithPositions } = await supabaseAdmin
          .from('articles')
          .select('id, review_position, final_position')
          .eq('campaign_id', campaign_id)
          .or('review_position.not.is.null,final_position.not.is.null')

        if (articlesWithPositions && articlesWithPositions.length > 0) {
          console.log(`📊 Preserved position data for ${articlesWithPositions.length} articles with tracking information`)
        }
      }
    } catch (archiveError) {
      // Archive failure shouldn't block RSS processing, but we should log it
      console.warn('⚠️ Archive failed, but continuing with RSS processing:', archiveError)
      await errorHandler.logInfo('Archive failed but RSS processing continuing', {
        campaignId: campaign_id,
        archiveError: archiveError instanceof Error ? archiveError.message : 'Unknown error'
      }, 'rss_step_archive')
    }

    // Clear previous articles and posts for this campaign to allow fresh processing
    console.log('Clearing previous articles and posts...')

    // Delete existing articles for this campaign
    const { error: articlesDeleteError } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('campaign_id', campaign_id)

    if (articlesDeleteError) {
      console.warn('Warning: Failed to delete previous articles:', articlesDeleteError)
    } else {
      console.log('Previous articles cleared successfully')
    }

    // Delete existing secondary articles for this campaign
    const { error: secondaryDeleteError } = await supabaseAdmin
      .from('secondary_articles')
      .delete()
      .eq('campaign_id', campaign_id)

    if (secondaryDeleteError) {
      console.warn('Warning: Failed to delete previous secondary articles:', secondaryDeleteError)
    } else {
      console.log('Previous secondary articles cleared successfully')
    }

    // Delete existing posts for this campaign
    const { error: postsDeleteError } = await supabaseAdmin
      .from('rss_posts')
      .delete()
      .eq('campaign_id', campaign_id)

    if (postsDeleteError) {
      console.warn('Warning: Failed to delete previous posts:', postsDeleteError)
    } else {
      console.log('Previous posts cleared successfully')
    }

    console.log(`[Step 1/7] Complete: Archived old data and cleared campaign`)

    // Chain to next step: Fetch RSS feeds
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Don't await - let it run asynchronously
    fetch(`${baseUrl}/api/rss/steps/fetch-feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id })
    }).catch(error => {
      console.error('[Step 1] Failed to trigger next step:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Archive step completed, fetch-feeds step triggered',
      campaign_id,
      next_step: 'fetch-feeds',
      step: '1/7'
    })

  } catch (error) {
    console.error('[Step 1] Archive failed:', error)
    return NextResponse.json({
      error: 'Archive step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '1/7'
    }, { status: 500 })
  }
}
