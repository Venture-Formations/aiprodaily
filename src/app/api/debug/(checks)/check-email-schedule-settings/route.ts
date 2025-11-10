import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all email-related settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, updated_at')
      .like('key', 'email_%')
      .order('key')

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Email schedule settings from database',
      count: settings?.length || 0,
      settings: settings || [],
      schedule_settings: settings?.filter(s =>
        s.key.includes('Time') || s.key.includes('Enabled')
      ) || []
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check email schedule settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
