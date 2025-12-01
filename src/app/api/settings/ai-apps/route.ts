import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

// Valid setting keys for AI apps
const VALID_SETTING_KEYS = [
  'ai_apps_per_newsletter',
  'ai_apps_max_per_category',
  'affiliate_cooldown_days'
]

/**
 * GET /api/settings/ai-apps - Get AI app settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's publication_id (use first active newsletter for now)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value, description')
      .eq('publication_id', newsletter.id)
      .in('key', VALID_SETTING_KEYS)
      .order('key')

    // Convert to flat object for easier editing
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's publication_id (use first active newsletter for now)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings format' },
        { status: 400 }
      )
    }

    // Update each valid setting
    for (const [key, value] of Object.entries(settings)) {
      // Only update valid AI app settings
      if (!VALID_SETTING_KEYS.includes(key)) {
        continue // Skip invalid settings
      }

      const { error } = await supabaseAdmin
        .from('publication_settings')
        .upsert({
          key,
          value: String(value),
          publication_id: newsletter.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'publication_id,key'
        })

      if (error) {
        console.error(`Failed to update setting ${key}:`, error)
        throw error
      }
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
