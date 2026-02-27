import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-dates' },
  async ({ request, logger }) => {
    // Calculate dates EXACTLY as RSS Processing does (tomorrow in Central Time)
    const ctParts1 = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date())
    const [ctYear1, ctMonth1, ctDay1] = ctParts1.split('-').map(Number)
    const tomorrowDate1 = new Date(ctYear1, ctMonth1 - 1, ctDay1 + 1)
    const rssProcessingDate = `${tomorrowDate1.getFullYear()}-${String(tomorrowDate1.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate1.getDate()).padStart(2, '0')}`

    // Calculate dates EXACTLY as Create issue does (tomorrow in Central Time)
    const ctParts2 = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date())
    const [ctYear2, ctMonth2, ctDay2] = ctParts2.split('-').map(Number)
    const tomorrowDate2 = new Date(ctYear2, ctMonth2 - 1, ctDay2 + 1)
    const createissueDate = `${tomorrowDate2.getFullYear()}-${String(tomorrowDate2.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate2.getDate()).padStart(2, '0')}`

    // Check for issue with RSS Processing date
    const { data: rssissue } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at, subject_line')
      .eq('date', rssProcessingDate)
      .single()

    // Check for issue with Create issue date
    const { data: createissue } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at, subject_line')
      .eq('date', createissueDate)
      .single()

    // Check what campaigns exist
    const { data: allCampaigns, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at, subject_line')
      .order('date', { ascending: false })
      .limit(10)

    const datesMismatch = rssProcessingDate !== createissueDate

    return NextResponse.json({
      debug: 'Date Calculation Comparison',
      currentTime: {
        utc: new Date().toISOString(),
        central: ctParts1,
      },
      rssProcessing: {
        description: "RSS Processing creates issue for tomorrow in Central Time",
        calculation: "Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }) + 1 day",
        issueDate: rssProcessingDate,
        foundissue: rssissue ? {
          id: rssissue.id,
          date: rssissue.date,
          status: rssissue.status,
          created_at: rssissue.created_at
        } : null
      },
      createissue: {
        description: "Create issue targets tomorrow in Central Time",
        calculation: "Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }) + 1 day",
        issueDate: createissueDate,
        foundissue: createissue ? {
          id: createissue.id,
          date: createissue.date,
          status: createissue.status,
          created_at: createissue.created_at
        } : null
      },
      analysis: {
        datesMismatch,
        diagnosis: datesMismatch
          ? "DATES DON'T MATCH - RSS Processing creates for " + rssProcessingDate + " but Create issue looks for " + createissueDate
          : "Dates match - both endpoints target tomorrow in CT: " + rssProcessingDate,
        explanation: "All endpoints use tomorrow in Central Time, matching send-review logic. This ensures consistent issue dates regardless of time of day.",
        possibleCause: datesMismatch
          ? "If Create issue doesn't find a issue, it would return 404. No duplicate should be created."
          : "Both endpoints should work with the same issue."
      },
      allCampaigns: allCampaigns || [],
      timestamp: new Date().toISOString()
    })
  }
)
