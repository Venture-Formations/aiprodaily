import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to assign a specific ad to a issue for testing
 * Does NOT update ad usage statistics
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/assign-test-ad' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { issueId, adId } = body

    if (!issueId || !adId) {
      return NextResponse.json(
        { error: 'Missing issueId or adId' },
        { status: 400 }
      )
    }

    // Get issue date
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('date')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json(
        { error: 'issue not found', details: issueError },
        { status: 404 }
      )
    }

    // Check if already assigned
    const { data: existing } = await supabaseAdmin
      .from('issue_advertisements')
      .select('id')
      .eq('issue_id', issueId)
      .maybeSingle()

    if (existing) {
      // Update existing assignment
      const { error: updateError } = await supabaseAdmin
        .from('issue_advertisements')
        .update({
          advertisement_id: adId,
          issue_date: issue.date,
          used_at: new Date().toISOString()
        })
        .eq('issue_id', issueId)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update assignment', details: updateError },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Updated existing ad assignment (no usage stats changed)',
        issueId,
        adId
      })
    } else {
      // Insert new assignment
      const { error: insertError } = await supabaseAdmin
        .from('issue_advertisements')
        .insert({
          issue_id: issueId,
          advertisement_id: adId,
          issue_date: issue.date,
          used_at: new Date().toISOString()
        })

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to insert assignment', details: insertError },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Created new ad assignment (no usage stats changed)',
        issueId,
        adId
      })
    }
  }
)
