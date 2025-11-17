import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

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

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      // Only update ai_apps_ settings and affiliate_cooldown_days
      if (!key.startsWith('ai_apps_') && key !== 'affiliate_cooldown_days') {
        continue // Skip non-AI-app settings
      }

      await supabaseAdmin
        .from('publication_settings')
        .upsert({
          key,
          value: String(value),
          publication_id: newsletter.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'publication_id,key'
        })
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
