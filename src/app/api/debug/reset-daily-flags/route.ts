import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Reset all daily run flags to allow re-running today
    const resetKeys = [
      'last_rss_processing_run',
      'last_campaign_creation_run',
      'last_subject_generation_run',
      'last_final_send_run'
    ]

    const resetPromises = resetKeys.map(key =>
      supabaseAdmin
        .from('app_settings')
        .upsert({
          key: key,
          value: '1900-01-01' // Set to old date to allow running
        }, {
          onConflict: 'key'
        })
    )

    await Promise.all(resetPromises)

    return NextResponse.json({
      success: true,
      message: 'Daily run flags reset - processes can run again today',
      resetKeys,
      today,
      note: 'RSS processing and campaign creation should now be able to run when scheduled'
    })

  } catch (error) {
    console.error('Reset daily flags error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}