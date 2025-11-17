import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export async function GET(request: NextRequest) {
  try {
    // Get date from query param or default to 2025-11-13
    const sinceDate = request.nextUrl.searchParams.get('since') || '2025-11-13'
    const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false'

    console.log(`[Archive Missing] Looking for issues since ${sinceDate}, dryRun=${dryRun}`)

    // Find all issues that were sent (has final_sent_at) but not archived
    const { data: sentIssues, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, publication_id, date, subject_line, final_sent_at')
      .gte('date', sinceDate)
      .not('final_sent_at', 'is', null)
      .order('date', { ascending: true })

    if (issuesError) {
      return NextResponse.json({
        error: 'Failed to fetch issues',
        details: issuesError.message
      }, { status: 500 })
    }

    // Get already archived issue_ids
    const { data: archivedNewsletters } = await supabaseAdmin
      .from('archived_newsletters')
      .select('issue_id')

    const archivedIds = new Set(archivedNewsletters?.map(a => a.issue_id) || [])

    // Find issues that haven't been archived
    const missingArchives = sentIssues?.filter(issue => !archivedIds.has(issue.id)) || []

    console.log(`[Archive Missing] Found ${missingArchives.length} missing archives out of ${sentIssues?.length} sent issues`)

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        message: `Found ${missingArchives.length} missing archives`,
        sinceDate,
        totalSentIssues: sentIssues?.length || 0,
        missingArchives: missingArchives.map(issue => ({
          id: issue.id,
          publication_id: issue.publication_id,
          date: issue.date,
          subject_line: issue.subject_line,
          final_sent_at: issue.final_sent_at
        })),
        note: 'Add ?dryRun=false to actually archive these issues'
      })
    }

    // Archive each missing issue
    const results = []
    for (const issue of missingArchives) {
      console.log(`[Archive Missing] Archiving issue ${issue.id} (${issue.date})...`)

      const result = await newsletterArchiver.archiveNewsletter({
        issueId: issue.id,
        issueDate: issue.date,
        subjectLine: issue.subject_line || `Newsletter ${issue.date}`,
        recipientCount: 0 // We don't have this info now, but can update later
      })

      results.push({
        issueId: issue.id,
        date: issue.date,
        subject_line: issue.subject_line,
        success: result.success,
        error: result.error
      })

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Archived ${successCount} newsletters, ${failCount} failed`,
      sinceDate,
      results
    })

  } catch (error) {
    console.error('[Archive Missing] Error:', error)
    return NextResponse.json({
      error: 'Failed to archive missing newsletters',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
