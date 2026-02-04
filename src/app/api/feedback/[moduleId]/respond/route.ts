import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// GET /api/feedback/[moduleId]/respond - Handle feedback vote from email link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params
    const searchParams = request.nextUrl.searchParams
    const valueStr = searchParams.get('value')
    const label = searchParams.get('label')
    const email = searchParams.get('email')
    const issueId = searchParams.get('issue_id')

    // Validate required parameters
    if (!valueStr || !label || !email || !issueId) {
      return NextResponse.redirect(
        new URL('/feedback/error?message=Missing required parameters', request.url)
      )
    }

    const value = parseInt(valueStr)
    if (isNaN(value)) {
      return NextResponse.redirect(
        new URL('/feedback/error?message=Invalid vote value', request.url)
      )
    }

    // Get IP address from request headers
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')

    // Record the vote
    const result = await FeedbackModuleSelector.recordVote(
      moduleId,
      issueId,
      email,
      value,
      label,
      ipAddress || undefined
    )

    if (!result.success) {
      console.error('[Feedback] Error recording vote:', result.error)
      return NextResponse.redirect(
        new URL(`/feedback/error?message=${encodeURIComponent(result.error || 'Failed to record response')}`, request.url)
      )
    }

    console.log(`[Feedback] Vote recorded: ${email} -> ${label} (${value}) for issue ${issueId}`)

    // Redirect to results page with all necessary params
    const resultsUrl = new URL('/feedback/results', request.url)
    resultsUrl.searchParams.set('module_id', moduleId)
    resultsUrl.searchParams.set('issue_id', issueId)
    resultsUrl.searchParams.set('email', email)
    resultsUrl.searchParams.set('vote', valueStr)
    if (result.voteId) {
      resultsUrl.searchParams.set('vote_id', result.voteId)
    }

    return NextResponse.redirect(resultsUrl)
  } catch (error) {
    console.error('[Feedback] Error in GET /api/feedback/[moduleId]/respond:', error)
    return NextResponse.redirect(
      new URL('/feedback/error?message=An unexpected error occurred', request.url)
    )
  }
}
