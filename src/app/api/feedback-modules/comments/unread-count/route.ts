import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// GET /api/feedback-modules/comments/unread-count - Get unread comment count
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { success: false, error: 'publication_id required' },
        { status: 400 }
      )
    }

    // Try to get session for user-specific read tracking
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    // If user is logged in, get their specific unread count
    // Otherwise, get total unread count (for staging/unauthenticated)
    const count = userId
      ? await FeedbackModuleSelector.getUnreadCommentCount(publicationId, userId)
      : await FeedbackModuleSelector.getTotalUnreadCommentCount(publicationId)

    return NextResponse.json({
      success: true,
      count
    })
  } catch (error) {
    console.error('[FeedbackComments] Error getting unread count:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get unread count' },
      { status: 500 }
    )
  }
}
