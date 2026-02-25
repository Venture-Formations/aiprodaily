import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { ArticleArchiveService } from '@/lib/article-archive'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/archived-articles' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')
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

    // Get archived articles by issue ID
    if (issueId) {
      const archivedArticles = await archiveService.getArchivedArticles(issueId)

      return NextResponse.json({
        success: true,
        issue_id: issueId,
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
          issue_date: article.issue_date,
          issue_status: article.issue_status
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
        issues_archived: Array.from(new Set(archivedArticles.map(a => a.issue_id))).length,
        archived_articles: archivedArticles.map(article => ({
          id: article.id,
          original_article_id: article.original_article_id,
          issue_id: article.issue_id,
          headline: article.headline,
          review_position: article.review_position,
          final_position: article.final_position,
          is_active: article.is_active,
          archived_at: article.archived_at,
          archive_reason: article.archive_reason,
          issue_date: article.issue_date,
          issue_status: article.issue_status
        })),
        timestamp: new Date().toISOString()
      })
    }

    // If no specific parameters, return recent archive stats and sample
    const stats = await archiveService.getArchiveStats()

    return NextResponse.json({
      success: true,
      message: 'Article Archive API - provide issueId, date range (start_date & end_date), or stats_only=true',
      stats,
      examples: {
        by_issue: '/api/debug/archived-articles?issueId=YOUR_issue_ID',
        by_date_range: '/api/debug/archived-articles?start_date=2025-09-01&end_date=2025-09-30',
        stats_only: '/api/debug/archived-articles?stats_only=true'
      },
      timestamp: new Date().toISOString()
    })
  }
)
