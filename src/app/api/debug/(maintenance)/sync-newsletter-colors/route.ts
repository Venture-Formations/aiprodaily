import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/sync-newsletter-colors' },
  async ({ logger }) => {
  try {
    // Fetch colors from app_settings (business settings)
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

    const primaryColor = settingsMap.primary_color
    if (!primaryColor) {
      return NextResponse.json({
        error: 'Primary color not found in app_settings. Please save your business settings first.'
      }, { status: 400 })
    }

    // Update the newsletters table to match app_settings
    const { error: updateError } = await supabaseAdmin
      .from('publications')
      .update({ primary_color: primaryColor })
      .eq('slug', 'accounting')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter colors synced successfully!',
      updated_values: {
        newsletters_table_primary_color: primaryColor,
        synced_from: 'app_settings.primary_color'
      },
      note: 'Both newsletter templates and dashboard UI will now use the same color'
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to sync colors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
  }
)
