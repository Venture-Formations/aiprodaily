import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// Fallback user ID for staging/unauthenticated access
const STAGING_USER_ID = 'staging-user'

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
    // Use session user ID or fallback to staging user
    const userId = session?.user?.id || STAGING_USER_ID

    // Get user-specific unread count (works for both real users and staging)
    const count = await FeedbackModuleSelector.getUnreadCommentCount(publicationId, userId)

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
