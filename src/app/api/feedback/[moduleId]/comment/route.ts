import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// POST /api/feedback/[moduleId]/comment - Submit additional feedback
export const POST = withApiHandler(
  { authTier: 'public', logContext: 'feedback-comment' },
  async ({ request, params, logger }) => {
    const moduleId = params.moduleId
    const body = await request.json()
    const { issue_id, email, comment_text, vote_id } = body

    if (!comment_text || !comment_text.trim()) {
      return NextResponse.json(
        { success: false, error: 'comment_text is required' },
        { status: 400 }
      )
    }

    // If vote_id is provided, use it directly
    if (vote_id) {
      const result = await FeedbackModuleSelector.addComment(vote_id, comment_text.trim())

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      console.log(`[Feedback] Comment added to vote ${vote_id}`)
      return NextResponse.json({
        success: true,
        comment_id: result.commentId
      })
    }

    // Otherwise, find the vote by email and issue
    if (!issue_id || !email) {
      return NextResponse.json(
        { success: false, error: 'issue_id and email are required when vote_id is not provided' },
        { status: 400 }
      )
    }

    const vote = await FeedbackModuleSelector.getVoteByEmail(moduleId, issue_id, email)

    if (!vote) {
      return NextResponse.json(
        { success: false, error: 'No vote found for this email and issue' },
        { status: 404 }
      )
    }

    const result = await FeedbackModuleSelector.addComment(vote.id, comment_text.trim())

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    console.log(`[Feedback] Comment added for ${email} on issue ${issue_id}`)
    return NextResponse.json({
      success: true,
      comment_id: result.commentId
    })
  }
)
