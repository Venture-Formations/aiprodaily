import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const WEBSITE_SETTINGS_KEYS = [
  'website_callout_text',
  'website_heading',
  'website_subheading',
  'tools_directory_enabled',
]

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/website' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const { data: settings, error } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publicationId)
      .in('key', WEBSITE_SETTINGS_KEYS)

    if (error) {
      throw error
    }

    const settingsObject: Record<string, any> = {}
    settings?.forEach(setting => {
      let cleanValue = setting.value
      if (cleanValue && cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
        cleanValue = cleanValue.slice(1, -1)
      }
      if (cleanValue === 'true' || cleanValue === 'false') {
        settingsObject[setting.key] = cleanValue === 'true'
      } else {
        settingsObject[setting.key] = cleanValue
      }
    })

    return NextResponse.json(settingsObject)
  }
)

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/website' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const body = await request.json()

    for (const key of WEBSITE_SETTINGS_KEYS) {
      if (body[key] !== undefined) {
        const value = typeof body[key] === 'boolean' ? String(body[key]) : body[key]

        await supabaseAdmin
          .from('publication_settings')
          .upsert({
            key,
            value,
            publication_id: publicationId,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'publication_id,key'
          })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Website settings saved successfully'
    })
  }
)
