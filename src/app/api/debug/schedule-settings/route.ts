import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {

    // Get all email schedule settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'email_%')

    // Also check the last run dates
    const { data: lastRuns } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'last_%_run')

    // Get current Central Time
    const now = new Date()
    const centralTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"}))
    const currentCT = `${centralTime.getHours().toString().padStart(2, '0')}:${centralTime.getMinutes().toString().padStart(2, '0')}`

    return NextResponse.json({
      currentTime: {
        utc: now.toISOString(),
        central: centralTime.toLocaleString("en-US", {timeZone: "America/Chicago"}),
        centralTime24h: currentCT
      },
      settings: settings || [],
      lastRuns: lastRuns || [],
      today: new Date().toISOString().split('T')[0]
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get schedule settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}