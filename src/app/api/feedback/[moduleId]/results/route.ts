import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// GET /api/feedback/[moduleId]/results - Get feedback results for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params
    const searchParams = request.nextUrl.searchParams
    const issueId = searchParams.get('issue_id')
    const email = searchParams.get('email')

    if (!issueId) {
      return NextResponse.json(
        { success: false, error: 'issue_id is required' },
        { status: 400 }
      )
    }

    const results = await FeedbackModuleSelector.getIssueResults(
      moduleId,
      issueId,
      email || undefined
    )

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('[Feedback] Error in GET results:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch results' },
      { status: 500 }
    )
  }
}
