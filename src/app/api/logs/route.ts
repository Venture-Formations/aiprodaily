import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const since = url.searchParams.get('since') || new Date(Date.now() - 5 * 60 * 1000).toISOString() // Last 5 minutes

    // Get recent system logs
    const { data: logs, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    return NextResponse.json({
      logs: logs || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to get logs:', error)
    return NextResponse.json({
      error: 'Failed to get logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}