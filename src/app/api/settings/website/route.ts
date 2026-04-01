import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const WEBSITE_SETTINGS_KEYS = [
  'website_callout_text',
  'website_heading',
  'website_subheading',
  'tools_directory_enabled',
  // Subscribe page
  'subscribe_heading',
  'subscribe_heading_styled',
  'subscribe_subheading',
  'subscribe_tagline',
  // Subscribe info page
  'subscribe_info_heading',
  'subscribe_info_heading_styled',
  'subscribe_info_subheading',
  'subscribe_info_job_label',
  'subscribe_info_job_options',
  'subscribe_info_clients_label',
  'subscribe_info_clients_options',
  'subscribe_info_submit_text',
]

const JSON_SETTINGS_KEYS = new Set([
  'subscribe_info_job_options',
  'subscribe_info_clients_options',
])

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
      } else if (JSON_SETTINGS_KEYS.has(setting.key)) {
        try {
          settingsObject[setting.key] = JSON.parse(cleanValue)
        } catch {
          settingsObject[setting.key] = cleanValue
        }
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
        let value: string
        if (typeof body[key] === 'boolean') {
          value = String(body[key])
        } else if (JSON_SETTINGS_KEYS.has(key)) {
          value = typeof body[key] === 'string' ? body[key] : JSON.stringify(body[key])
        } else {
          value = body[key]
        }

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
