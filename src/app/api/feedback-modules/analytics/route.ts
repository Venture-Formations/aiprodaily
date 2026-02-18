import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 60

// Fallback user ID for staging/unauthenticated access (must be valid UUID)
const STAGING_USER_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/feedback-modules/analytics - Get feedback mod analytics for dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Use session user ID or fallback to staging user
    const userId = session?.user?.id || STAGING_USER_ID

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

    // Get the feedback mod
    const mod = await FeedbackModuleSelector.getFeedbackModule(publicationId)

    if (!mod) {
      return NextResponse.json({
        success: true,
        mod: null,
        stats: [],
        recent_comments: [],
        summary: {
          total_votes: 0,
          average_score: 0,
          total_comments: 0,
          unread_comments: 0,
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

    // Get recent comments with read status (works for both real users and staging)
    const recentComments = await FeedbackModuleSelector.getRecentCommentsWithReadStatus(publicationId, userId, 20)

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

    // Count unread comments
    const unreadComments = recentComments.filter(c => !c.is_read).length

    return NextResponse.json({
      success: true,
      mod,
      summary: {
        total_votes: totalVotes,
        average_score: overallAverage,
        total_comments: totalComments,
        unread_comments: unreadComments,
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
