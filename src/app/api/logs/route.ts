import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'logs' },
  async ({ request }) => {
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
  }
)
