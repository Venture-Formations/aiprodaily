import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all last run settings
    const { data: lastRuns } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, updated_at')
      .in('key', [
        'last_rss_processing_run',
        'last_campaign_creation_run',
        'last_final_send_run',
        'last_subject_generation_run'
      ])
      .order('key')

    // Also get recent campaigns to compare
    const { data: recentCampaigns } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      lastRuns,
      recentCampaigns,
      currentDate: new Date().toISOString().split('T')[0],
      currentTime: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking last runs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}