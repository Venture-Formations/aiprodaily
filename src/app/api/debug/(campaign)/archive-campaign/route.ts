import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/archive-campaign' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')
    const issueDate = searchParams.get('date')

    if (!issueId && !issueDate) {
      return NextResponse.json({
        error: 'Missing required parameter: issueId or date',
        usage: 'Call with ?issueId=XXX or ?date=YYYY-MM-DD'
      }, { status: 400 })
    }

    // View mode - just show archive contents
    const viewMode = searchParams.get('view') === 'true'
    if (viewMode) {
      const { data: archived, error: archiveError } = await supabaseAdmin
        .from('archived_newsletters')
        .select('*')
        .eq('issue_date', issueDate || '')
        .single()

      if (archiveError || !archived) {
        return NextResponse.json({
          error: 'Archive not found',
          details: archiveError?.message
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        archive: {
          id: archived.id,
          issue_date: archived.issue_date,
          subject_line: archived.subject_line,
          metadata: archived.metadata,
          sections_keys: Object.keys(archived.sections || {}),
          sections: archived.sections
        }
      })
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
    const force = searchParams.get('force') === 'true'
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('archived_newsletters')
      .select('id, issue_date')
      .eq('issue_id', issue.id)
      .single()

    if (existing && !existingError) {
      if (!force) {
        return NextResponse.json({
          success: false,
          message: 'issue already archived',
          archive_id: existing.id,
          issue_date: existing.issue_date,
          note: 'Add &force=true to re-archive and overwrite'
        })
      }
      // Delete existing archive to re-archive
      console.log('[ARCHIVE] Force re-archive requested, deleting existing archive:', existing.id)
      const { error: deleteError } = await supabaseAdmin
        .from('archived_newsletters')
        .delete()
        .eq('id', existing.id)

      if (deleteError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to delete existing archive',
          details: deleteError.message
        }, { status: 500 })
      }
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
  }
)
