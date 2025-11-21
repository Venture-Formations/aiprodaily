import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Polls Analytics Endpoint
 * Provides aggregated poll response analytics for the analytics dashboard
 *
 * Query Parameters:
 * - publication_id: Required - Filter by publication
 * - poll_id: Optional - Specific poll ID (if not provided, shows all polls)
 * - issue_id: Optional - Filter by specific issue
 * - start_date: Optional - Start date (YYYY-MM-DD format)
 * - end_date: Optional - End date (YYYY-MM-DD format)
 * - days: Optional - Number of days to look back (default: 30, ignored if start_date provided)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')
    const pollId = searchParams.get('poll_id')
    const issueId = searchParams.get('issue_id')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const days = parseInt(searchParams.get('days') || '30')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Calculate date range using local timezone (NO UTC - per CLAUDE.md)
    let startDateStr: string
    let endDateStr: string

    if (startDateParam && endDateParam) {
      startDateStr = startDateParam
      endDateStr = endDateParam
    } else {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    }

    console.log(`[Poll Analytics] Fetching for publication ${publicationId}, date range: ${startDateStr} to ${endDateStr}`)

    // Fetch all polls for this publication
    let pollsQuery = supabaseAdmin
      .from('polls')
      .select('id, title, question, options, is_active, created_at')
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })

    if (pollId) {
      pollsQuery = pollsQuery.eq('id', pollId)
    }

    const { data: polls, error: pollsError } = await pollsQuery

    if (pollsError) {
      console.error('[Poll Analytics] Error fetching polls:', pollsError)
      return NextResponse.json({ error: pollsError.message }, { status: 500 })
    }

    if (!polls || polls.length === 0) {
      return NextResponse.json({
        polls: [],
        message: 'No polls found'
      })
    }

    // Fetch all responses for these polls within date range
    let responsesQuery = supabaseAdmin
      .from('poll_responses')
      .select('id, poll_id, issue_id, subscriber_email, selected_option, responded_at')
      .eq('publication_id', publicationId)
      .gte('responded_at', startDateStr)
      .lte('responded_at', endDateStr + 'T23:59:59')

    if (pollId) {
      responsesQuery = responsesQuery.eq('poll_id', pollId)
    }

    if (issueId) {
      responsesQuery = responsesQuery.eq('issue_id', issueId)
    }

    const { data: responses, error: responsesError } = await responsesQuery

    if (responsesError) {
      console.error('[Poll Analytics] Error fetching responses:', responsesError)
      return NextResponse.json({ error: responsesError.message }, { status: 500 })
    }

    // Fetch issues in date range to calculate response rates
    const { data: issues, error: issuesError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, poll_id, metrics')
      .eq('publication_id', publicationId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .eq('status', 'sent')
      .not('poll_id', 'is', null)

    if (issuesError) {
      console.error('[Poll Analytics] Error fetching issues:', issuesError)
    }

    // Build analytics for each poll
    const pollAnalytics = polls.map(poll => {
      const pollResponses = responses?.filter(r => r.poll_id === poll.id) || []
      const pollIssues = issues?.filter(i => i.poll_id === poll.id) || []

      // Calculate option counts and percentages
      const optionCounts: Record<string, number> = {}
      poll.options.forEach((option: string) => {
        optionCounts[option] = 0
      })

      pollResponses.forEach(response => {
        if (optionCounts.hasOwnProperty(response.selected_option)) {
          optionCounts[response.selected_option]++
        }
      })

      const totalResponses = pollResponses.length
      const optionPercentages: Record<string, number> = {}

      Object.keys(optionCounts).forEach(option => {
        optionPercentages[option] = totalResponses > 0
          ? Math.round((optionCounts[option] / totalResponses) * 100)
          : 0
      })

      // Calculate unique respondents
      const uniqueRespondents = new Set(pollResponses.map(r => r.subscriber_email)).size

      // Calculate response rate (if we have issue metrics)
      let responseRate: number | null = null
      let totalRecipients = 0

      if (pollIssues.length > 0) {
        pollIssues.forEach(issue => {
          if (issue.metrics?.sent_count) {
            totalRecipients += issue.metrics.sent_count
          }
        })

        if (totalRecipients > 0) {
          responseRate = Math.round((uniqueRespondents / totalRecipients) * 100)
        }
      }

      // Group by issue for per-issue breakdown
      const byIssue: Record<string, any> = {}

      pollResponses.forEach(response => {
        if (response.issue_id) {
          if (!byIssue[response.issue_id]) {
            const issue = pollIssues.find(i => i.id === response.issue_id)
            byIssue[response.issue_id] = {
              issue_id: response.issue_id,
              issue_date: issue?.date || null,
              responses: [],
              option_counts: { ...optionCounts },
              total_responses: 0,
              unique_respondents: new Set()
            }
            // Reset option counts for this issue
            poll.options.forEach((option: string) => {
              byIssue[response.issue_id].option_counts[option] = 0
            })
          }

          byIssue[response.issue_id].responses.push(response)
          byIssue[response.issue_id].option_counts[response.selected_option]++
          byIssue[response.issue_id].total_responses++
          byIssue[response.issue_id].unique_respondents.add(response.subscriber_email)
        }
      })

      // Convert unique respondents set to count and add percentages
      const issueBreakdown = Object.values(byIssue).map((issueData: any) => {
        const uniqueCount = issueData.unique_respondents.size
        const optionPercentages: Record<string, number> = {}

        Object.keys(issueData.option_counts).forEach(option => {
          optionPercentages[option] = issueData.total_responses > 0
            ? Math.round((issueData.option_counts[option] / issueData.total_responses) * 100)
            : 0
        })

        return {
          issue_id: issueData.issue_id,
          issue_date: issueData.issue_date,
          total_responses: issueData.total_responses,
          unique_respondents: uniqueCount,
          option_counts: issueData.option_counts,
          option_percentages: optionPercentages
        }
      }).sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''))

      return {
        poll_id: poll.id,
        poll_title: poll.title,
        poll_question: poll.question,
        poll_options: poll.options,
        is_active: poll.is_active,
        created_at: poll.created_at,
        aggregated: {
          total_responses: totalResponses,
          unique_respondents: uniqueRespondents,
          response_rate: responseRate,
          total_recipients: totalRecipients > 0 ? totalRecipients : null,
          issues_included: pollIssues.length,
          option_counts: optionCounts,
          option_percentages: optionPercentages
        },
        by_issue: issueBreakdown
      }
    })

    console.log(`[Poll Analytics] Returned analytics for ${pollAnalytics.length} poll(s)`)

    return NextResponse.json({
      success: true,
      date_range: {
        start: startDateStr,
        end: endDateStr
      },
      polls: pollAnalytics
    })

  } catch (error) {
    console.error('[Poll Analytics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
