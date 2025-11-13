import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all "last run" tracking settings
    const { data: lastRunSettings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, updated_at')
      .or('key.eq.last_rss_processing_run,key.eq.last_issue_creation_run,key.eq.last_review_send_run,key.eq.last_final_send_run,key.eq.last_event_population_run')
      .order('key')

    // Get current date in Central Time
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const today = centralDate.toISOString().split('T')[0]

    return NextResponse.json({
      success: true,
      today,
      currentCentralTime: nowCentral,
      lastRunSettings: lastRunSettings || [],
      analysis: lastRunSettings?.map(s => ({
        task: s.key.replace('last_', '').replace('_run', ''),
        lastRunDate: s.value,
        isToday: s.value === today,
        willRunToday: s.value !== today,
        updatedAt: s.updated_at
      }))
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { resetKey } = body

    if (!resetKey) {
      return NextResponse.json({
        error: 'resetKey is required (e.g., "last_review_send_run")'
      }, { status: 400 })
    }

    // Reset the last run date to yesterday
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const yesterday = new Date(centralDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = yesterday.toISOString().split('T')[0]

    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        key: resetKey,
        value: yesterdayDate,
        description: `Last run date for ${resetKey} (manually reset)`,
        updated_at: new Date().toISOString()
      })

    if (error) {
      return NextResponse.json({
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${resetKey} to ${yesterdayDate}`,
      resetKey,
      newValue: yesterdayDate
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
