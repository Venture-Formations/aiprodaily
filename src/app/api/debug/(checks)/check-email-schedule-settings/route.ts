import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-email-schedule-settings' },
  async () => {
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
  }
)
