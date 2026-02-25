import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-email-settings' },
  async () => {
    console.log('=== EMAIL SETTINGS DEBUG ===')

    // Get ALL email settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .like('key', 'email_%')
      .order('key')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Database settings:', settings)

    return NextResponse.json({
      success: true,
      count: settings?.length || 0,
      settings: settings || [],
      formatted: settings?.map(s => ({
        key: s.key.replace('email_', ''),
        value: s.value,
        isEmpty: s.value === '' || s.value === null,
        updated: s.updated_at
      }))
    }, { status: 200 })
  }
)
