import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
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

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
