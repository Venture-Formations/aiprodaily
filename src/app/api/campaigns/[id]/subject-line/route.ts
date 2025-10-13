import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    // Update the campaign's subject line
    const { data, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        subject_line: trimmedSubjectLine,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, subject_line')
      .single()

    if (error) {
      console.error('Database error updating subject line:', error)
      return NextResponse.json({
        error: 'Failed to update subject line'
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        error: 'Campaign not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      subject_line: data.subject_line,
      message: 'Subject line updated successfully'
    })

  } catch (error) {
    console.error('Error updating subject line:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}