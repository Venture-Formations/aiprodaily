import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// Fallback user ID for staging/unauthenticated access (must be valid UUID)
const STAGING_USER_ID = '00000000-0000-0000-0000-000000000001'

// POST /api/feedback-modules/comments/read - Mark comment(s) as read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Use session user ID or fallback to staging user for unauthenticated access
    const userId = session?.user?.id || STAGING_USER_ID

    const body = await request.json()
    const { comment_id, comment_ids, publication_id, mark_all } = body

    // Mark all comments as read
    if (mark_all && publication_id) {
      const result = await FeedbackModuleSelector.markAllCommentsAsRead(
        publication_id,
        userId
      )
      return NextResponse.json({
        success: result.success,
        count: result.count,
        error: result.error
      })
    }

    // Mark specific comments as read
    const idsToMark = comment_ids || (comment_id ? [comment_id] : [])

    if (idsToMark.length === 0) {
      return NextResponse.json(
        { success: false, error: 'comment_id or comment_ids required' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      idsToMark.map((id: string) =>
        FeedbackModuleSelector.markCommentAsRead(id, userId)
      )
    )

    const allSuccess = results.every(r => r.success)
    const errors = results.filter(r => !r.success).map(r => r.error)

    return NextResponse.json({
      success: allSuccess,
      count: idsToMark.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('[FeedbackComments] Error marking as read:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark as read' },
      { status: 500 }
    )
  }
}

// DELETE /api/feedback-modules/comments/read - Mark comment(s) as unread
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Use session user ID or fallback to staging user for unauthenticated access
    const userId = session?.user?.id || STAGING_USER_ID

    const searchParams = request.nextUrl.searchParams
    const commentId = searchParams.get('comment_id')

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'comment_id required' },
        { status: 400 }
      )
    }

    const result = await FeedbackModuleSelector.markCommentAsUnread(
      commentId,
      userId
    )

    return NextResponse.json({
      success: result.success,
      error: result.error
    })
  } catch (error) {
    console.error('[FeedbackComments] Error marking as unread:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark as unread' },
      { status: 500 }
    )
  }
}
