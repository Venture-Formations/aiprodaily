import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')
    const issueDate = searchParams.get('date')

    if (!issueId && !issueDate) {
      return NextResponse.json({
        error: 'Missing required parameter: issueId or date',
        usage: 'Call with ?issueId=XXX or ?date=YYYY-MM-DD'
      }, { status: 400 })
    }

    console.log('[ARCHIVE] Manual archive request:', { issueId, issueDate })

    // Fetch issue
    let query = supabaseAdmin
      .from('publication_issues')
      .select('*')

    if (issueId) {
      query = query.eq('id', issueId)
    } else if (issueDate) {
      query = query.eq('date', issueDate)
    }

    const { data: issue, error: issueError } = await query.single()

    if (issueError || !issue) {
      return NextResponse.json({
        error: 'issue not found',
        details: issueError?.message,
        issueId,
        issueDate
      }, { status: 404 })
    }

    console.log('[ARCHIVE] Found issue:', {
      id: issue.id,
      date: issue.date,
      status: issue.status,
      subject_line: issue.subject_line
    })

    // Check if already archived
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('archived_newsletters')
      .select('id, issue_date')
      .eq('issue_id', issue.id)
      .single()

    if (existing && !existingError) {
      return NextResponse.json({
        success: false,
        message: 'issue already archived',
        archive_id: existing.id,
        issue_date: existing.issue_date,
        note: 'Delete the existing archive first if you want to re-archive'
      })
    }

    // Archive the newsletter
    const result = await newsletterArchiver.archiveNewsletter({
      issueId: issue.id,
      issueDate: issue.date,
      subjectLine: issue.subject_line || 'Newsletter',
      recipientCount: 0 // We don't have this data for past issues
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to archive newsletter',
        details: result.error
      }, { status: 500 })
    }

    // Verify archive was created
    const { data: archived, error: verifyError } = await supabaseAdmin
      .from('archived_newsletters')
      .select('id, issue_date, subject_line')
      .eq('issue_id', issue.id)
      .single()

    if (verifyError || !archived) {
      return NextResponse.json({
        success: false,
        error: 'Archive created but verification failed',
        details: verifyError?.message
      }, { status: 500 })
    }

    console.log('[ARCHIVE] Successfully archived:', archived)

    return NextResponse.json({
      success: true,
      message: 'Newsletter archived successfully',
      issue: {
        id: issue.id,
        date: issue.date,
        subject_line: issue.subject_line,
        status: issue.status
      },
      archive: {
        id: archived.id,
        issue_date: archived.issue_date,
        subject_line: archived.subject_line
      },
      note: 'Newsletter should now appear at /website/newsletters'
    })

  } catch (error: any) {
    console.error('[ARCHIVE] Error:', error)
    return NextResponse.json({
      error: 'Failed to archive issue',
      details: error.message
    }, { status: 500 })
  }
}
