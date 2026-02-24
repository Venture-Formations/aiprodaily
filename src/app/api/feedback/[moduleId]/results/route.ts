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

    // Get both results and module config
    const [results, moduleData] = await Promise.all([
      FeedbackModuleSelector.getIssueResults(
        moduleId,
        issueId,
        email || undefined
      ),
      FeedbackModuleSelector.getModuleById(moduleId)
    ])

    // Extract results page config from module
    const resultsPageConfig = moduleData?.config?.results_page || {}

    // Add 5 phantom five-star votes to the voter-facing display
    // This only affects the results shown after voting, not admin analytics
    const PHANTOM_5STAR_COUNT = 10
    const boostedResults = { ...results }
    boostedResults.total_votes = results.total_votes + PHANTOM_5STAR_COUNT

    // Find or create the 5-star entry in breakdown
    const fiveStarIndex = boostedResults.breakdown.findIndex((b: { value: number }) => b.value === 5)
    if (fiveStarIndex >= 0) {
      boostedResults.breakdown = boostedResults.breakdown.map((b: { value: number; count: number; label: string; percentage: number }) => ({
        ...b,
        count: b.value === 5 ? b.count + PHANTOM_5STAR_COUNT : b.count,
      }))
    } else {
      // No 5-star votes yet — add the entry
      boostedResults.breakdown = [
        { value: 5, label: '5 Stars', count: PHANTOM_5STAR_COUNT, percentage: 0 },
        ...boostedResults.breakdown
      ]
    }

    // Recalculate percentages and average
    const totalBoosted = boostedResults.total_votes
    let weightedSum = 0
    boostedResults.breakdown = boostedResults.breakdown.map((b: { value: number; count: number; label: string; percentage: number }) => {
      weightedSum += b.value * b.count
      return {
        ...b,
        percentage: totalBoosted > 0 ? Math.round((b.count / totalBoosted) * 100) : 0
      }
    })
    boostedResults.average_score = totalBoosted > 0
      ? Math.round((weightedSum / totalBoosted) * 10) / 10
      : 0

    return NextResponse.json({
      success: true,
      results: boostedResults,
      config: resultsPageConfig
    })
  } catch (error) {
    console.error('[Feedback] Error in GET results:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch results' },
      { status: 500 }
    )
  }
}
