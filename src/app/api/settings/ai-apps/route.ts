import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// Valid setting keys for AI apps
const VALID_SETTING_KEYS = [
  'ai_apps_per_newsletter',
  'ai_apps_max_per_category',
  'affiliate_cooldown_days'
]

/**
 * GET /api/settings/ai-apps - Get AI app settings
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/ai-apps' },
  async ({ request, logger }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const newsletter = { id: publicationId }

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
  }
)

/**
 * PATCH /api/settings/ai-apps - Update AI app settings
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/ai-apps' },
  async ({ request, logger }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const newsletter = { id: publicationId }

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
        logger.error({ key, err: error }, `Failed to update setting ${key}`)
        throw error
      }
    }

    return NextResponse.json({ success: true })
  }
)
