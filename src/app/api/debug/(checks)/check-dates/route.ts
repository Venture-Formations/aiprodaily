import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Calculate dates EXACTLY as RSS Processing does
    const nowCentral1 = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate1 = new Date(nowCentral1)
    centralDate1.setHours(centralDate1.getHours() + 12)
    const rssProcessingDate = centralDate1.toISOString().split('T')[0]

    // Calculate dates EXACTLY as Create issue does
    const nowCentral2 = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate2 = new Date(nowCentral2)
    centralDate2.setHours(centralDate2.getHours() + 12)
    const createissueDate = centralDate2.toISOString().split('T')[0]

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
        central: nowCentral1,
      },
      rssProcessing: {
        description: "RSS Processing creates issue for 'CT + 12 hours' (line 311-312 of rss-processor.ts)",
        calculation: "centralDate.setHours(centralDate.getHours() + 12); centralDate.toISOString().split('T')[0]",
        issueDate: rssProcessingDate,
        foundissue: rssissue ? {
          id: rssissue.id,
          date: rssissue.date,
          status: rssissue.status,
          created_at: rssissue.created_at
        } : null
      },
      createissue: {
        description: "Create issue queries for 'CT + 12 hours' (line 37-38 of create-issue/route.ts)",
        calculation: "centralDate.setHours(centralDate.getHours() + 12); centralDate.toISOString().split('T')[0]",
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
          ? "❌ DATES DON'T MATCH - RSS Processing creates for " + rssProcessingDate + " but Create issue looks for " + createissueDate
          : "✅ Dates match - both endpoints use CT + 12 hours: " + rssProcessingDate,
        explanation: "Both endpoints now add 12 hours to Central Time before extracting the date. This ensures morning runs use today's date, evening runs (8pm+) use tomorrow's date.",
        possibleCause: datesMismatch
          ? "If Create issue doesn't find a issue, it would return 404. No duplicate should be created."
          : "Both endpoints should work with the same issue."
      },
      allCampaigns: allCampaigns || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}