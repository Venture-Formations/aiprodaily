import { NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'
import { withApiHandler } from '@/lib/api-handler'

export const maxDuration = 30

// Fallback user ID for staging/unauthenticated access (must be valid UUID)
const STAGING_USER_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/feedback-modules/comments/unread-count - Get unread comment count
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'feedback-modules/comments/unread-count' },
  async ({ request, session }) => {
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { success: false, error: 'publication_id required' },
        { status: 400 }
      )
    }

    // Use session user ID or fallback to staging user
    const userId = session?.user?.id || STAGING_USER_ID

    // Get user-specific unread count (works for both real users and staging)
    const count = await FeedbackModuleSelector.getUnreadCommentCount(publicationId, userId)

    return NextResponse.json({
      success: true,
      count
    })
  }
)
