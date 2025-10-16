import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch color settings from app_settings table (global business settings)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['primary_color', 'secondary_color'])

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }

    const settingsMap: Record<string, string> = {}
    settings?.forEach(setting => {
      settingsMap[setting.key] = setting.value
    })

    // Also check newsletters table for newsletter-specific colors
    const { data: newsletters, error: newslettersError } = await supabaseAdmin
      .from('newsletters')
      .select('id, slug, name, primary_color')

    return NextResponse.json({
      success: true,
      app_settings: {
        database_values: settings,
        parsed_map: settingsMap,
        primary_color: settingsMap.primary_color || 'NOT FOUND',
        secondary_color: settingsMap.secondary_color || 'NOT FOUND'
      },
      newsletters_table: {
        all_newsletters: newsletters || [],
        note: 'If primary_color exists in newsletters table, it may override app_settings'
      },
      current_behavior: 'Newsletter templates use app_settings ONLY (not checking newsletters table)',
      recommended_fix: 'Either: (1) Update app_settings values, OR (2) Modify template functions to check newsletters table',
      message: 'Your business settings show primary=#1C293D and secondary=#3370ff, but templates may be using defaults'
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check colors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
