import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/settings/ai-apps - Get AI app settings
 */
export async function GET(request: NextRequest) {
  try {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .or('key.like.ai_apps_%,key.eq.affiliate_cooldown_days')
      .order('key')

    // Convert to object for easier access
    const settingsMap: Record<string, any> = {}
    settings?.forEach(s => {
      settingsMap[s.key] = {
        value: s.value,
        description: s.description
      }
    })

    return NextResponse.json({ settings: settingsMap })

  } catch (error: any) {
    console.error('Failed to fetch AI app settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/ai-apps - Update AI app settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings format' },
        { status: 400 }
      )
    }

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      // Only update ai_apps_ settings and affiliate_cooldown_days
      if (!key.startsWith('ai_apps_') && key !== 'affiliate_cooldown_days') {
        continue // Skip non-AI-app settings
      }

      await supabaseAdmin
        .from('app_settings')
        .update({ value: String(value) })
        .eq('key', key)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Failed to update AI app settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    )
  }
}
