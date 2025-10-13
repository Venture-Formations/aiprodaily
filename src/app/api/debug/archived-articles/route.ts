import { NextRequest, NextResponse } from 'next/server'
import { ArticleArchiveService } from '@/lib/article-archive'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const statsOnly = searchParams.get('stats_only') === 'true'

    const archiveService = new ArticleArchiveService()

    // Return just statistics if requested
    if (statsOnly) {
      const stats = await archiveService.getArchiveStats()
      return NextResponse.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      })
    }

    // Get archived articles by campaign ID
    if (campaignId) {
      const archivedArticles = await archiveService.getArchivedArticles(campaignId)

      return NextResponse.json({
        success: true,
        campaign_id: campaignId,
        archived_articles_count: archivedArticles.length,
        articles_with_positions: archivedArticles.filter(a =>
          a.review_position !== null || a.final_position !== null
        ).length,
        archived_articles: archivedArticles.map(article => ({
          id: article.id,
          original_article_id: article.original_article_id,
          headline: article.headline,
          review_position: article.review_position,
          final_position: article.final_position,
          is_active: article.is_active,
          archived_at: article.archived_at,
          archive_reason: article.archive_reason,
          campaign_date: article.campaign_date,
          campaign_status: article.campaign_status
        })),
        timestamp: new Date().toISOString()
      })
    }

    // Get archived articles by date range
    if (startDate && endDate) {
      const archivedArticles = await archiveService.getArchivedArticlesByDateRange(startDate, endDate)

      return NextResponse.json({
        success: true,
        date_range: { start: startDate, end: endDate },
        archived_articles_count: archivedArticles.length,
        articles_with_positions: archivedArticles.filter(a =>
          a.review_position !== null || a.final_position !== null
        ).length,
        campaigns_archived: Array.from(new Set(archivedArticles.map(a => a.campaign_id))).length,
        archived_articles: archivedArticles.map(article => ({
          id: article.id,
          original_article_id: article.original_article_id,
          campaign_id: article.campaign_id,
          headline: article.headline,
          review_position: article.review_position,
          final_position: article.final_position,
          is_active: article.is_active,
          archived_at: article.archived_at,
          archive_reason: article.archive_reason,
          campaign_date: article.campaign_date,
          campaign_status: article.campaign_status
        })),
        timestamp: new Date().toISOString()
      })
    }

    // If no specific parameters, return recent archive stats and sample
    const stats = await archiveService.getArchiveStats()

    return NextResponse.json({
      success: true,
      message: 'Article Archive API - provide campaign_id, date range (start_date & end_date), or stats_only=true',
      stats,
      examples: {
        by_campaign: '/api/debug/archived-articles?campaign_id=YOUR_CAMPAIGN_ID',
        by_date_range: '/api/debug/archived-articles?start_date=2025-09-01&end_date=2025-09-30',
        stats_only: '/api/debug/archived-articles?stats_only=true'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Archived articles API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch archived articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}