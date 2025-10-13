import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get current dates in different formats
    const now = new Date()
    const utcDate = now.toISOString()
    const centralTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"}))

    const today = now.toISOString().split('T')[0]
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]

    // Check what campaigns exist
    const { data: allCampaigns, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, created_at, subject_line')
      .order('date', { ascending: false })
      .limit(10)

    // Specifically check for tomorrow's campaign
    const { data: tomorrowCampaign, error: tomorrowError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, created_at, subject_line')
      .eq('date', tomorrowDate)
      .single()

    return NextResponse.json({
      debug: 'Date and Campaign Check',
      currentTime: {
        utc: utcDate,
        central: centralTime.toLocaleString("en-US", {timeZone: "America/Chicago"}),
        todayUTC: today,
        tomorrowUTC: tomorrowDate
      },
      allCampaigns: allCampaigns || [],
      tomorrowCampaign: tomorrowCampaign || null,
      tomorrowError: tomorrowError?.message || null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}