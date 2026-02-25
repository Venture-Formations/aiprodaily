import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/subject-line' },
  async ({ params, request, logger }) => {
    const id = params.id
    const { subject_line } = await request.json()

    if (!subject_line || typeof subject_line !== 'string') {
      return NextResponse.json({
        error: 'Subject line is required and must be a string'
      }, { status: 400 })
    }

    const trimmedSubjectLine = subject_line.trim()

    if (trimmedSubjectLine.length === 0) {
      return NextResponse.json({
        error: 'Subject line cannot be empty'
      }, { status: 400 })
    }

    // Update the issue's subject line
    const { data, error } = await supabaseAdmin
      .from('publication_issues')
      .update({
        subject_line: trimmedSubjectLine,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, subject_line')
      .single()

    if (error) {
      logger.error({ err: error }, 'Database error updating subject line')
      return NextResponse.json({
        error: 'Failed to update subject line'
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        error: 'issue not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      subject_line: data.subject_line,
      message: 'Subject line updated successfully'
    })
  }
)
