import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Base query: Only show public submitted events (not synced from external sources)
    // Public submissions have submitter_email (from the public submission form)
    let query = supabaseAdmin
      .from('events')
      .select('*')
      .not('submission_status', 'is', null)
      .not('submitter_email', 'is', null)  // Only public submissions
      .order('created_at', { ascending: false })

    // Filter by status if specified
    if (status && status !== 'all') {
      query = query.eq('submission_status', status)
    }

    const { data: submissions, error } = await query

    if (error) throw error

    // Get counts for all statuses (for the filter tabs)
    const { data: allSubmissions } = await supabaseAdmin
      .from('events')
      .select('submission_status')
      .not('submission_status', 'is', null)
      .not('submitter_email', 'is', null)  // Only public submissions

    const counts = {
      pending: allSubmissions?.filter(s => s.submission_status === 'pending').length || 0,
      approved: allSubmissions?.filter(s => s.submission_status === 'approved').length || 0,
      rejected: allSubmissions?.filter(s => s.submission_status === 'rejected').length || 0,
      all: allSubmissions?.length || 0
    }

    return NextResponse.json({
      submissions: submissions || [],
      counts
    })

  } catch (error) {
    console.error('Failed to load submissions:', error)
    return NextResponse.json({
      error: 'Failed to load submissions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
