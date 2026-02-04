import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 60

// GET /api/feedback-modules/analytics - Get feedback module analytics for dashboard
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    if (!publicationId) {
      return NextResponse.json(
        { success: false, error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Get the feedback module
    const module = await FeedbackModuleSelector.getFeedbackModule(publicationId)

    if (!module) {
      return NextResponse.json({
        success: true,
        module: null,
        stats: [],
        recent_comments: [],
        summary: {
          total_votes: 0,
          average_score: 0,
          total_comments: 0,
          issues_count: 0
        }
      })
    }

    // Get analytics stats
    const stats = await FeedbackModuleSelector.getAnalytics(
      publicationId,
      dateFrom || undefined,
      dateTo || undefined
    )

    // Get recent comments
    const recentComments = await FeedbackModuleSelector.getRecentComments(publicationId, 20)

    // Calculate overall summary
    let totalVotes = 0
    let totalScore = 0
    let totalComments = 0

    for (const stat of stats) {
      totalVotes += stat.total_votes
      totalScore += stat.average_score * stat.total_votes
      totalComments += stat.comments_count
    }

    const overallAverage = totalVotes > 0 ? Math.round((totalScore / totalVotes) * 10) / 10 : 0

    return NextResponse.json({
      success: true,
      module,
      summary: {
        total_votes: totalVotes,
        average_score: overallAverage,
        total_comments: totalComments,
        issues_count: stats.length
      },
      stats,
      recent_comments: recentComments
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in GET analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
