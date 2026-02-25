import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/settings/publication - Get individual publication setting
 * Query params: key (required), publication_id (optional - defaults to active publication)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/publication' },
  async ({ request }) => {
    const key = request.nextUrl.searchParams.get('key')
    let publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!key) {
      return NextResponse.json({ error: 'key parameter is required' }, { status: 400 })
    }

    // If no publication_id provided, get the active publication
    if (!publicationId) {
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'No active publication found' }, { status: 404 })
      }
      publicationId = newsletter.id
    }

    // Fetch the setting
    const { data: setting, error } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', publicationId)
      .eq('key', key)
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      key,
      value: setting?.value || null,
      publication_id: publicationId
    })
  }
)

/**
 * PATCH /api/settings/publication - Update publication setting
 * Body: { key, value, publication_id? }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/publication' },
  async ({ request }) => {
    const body = await request.json()
    const { key, value } = body
    let publicationId = body.publication_id

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 })
    }

    if (value === undefined) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 })
    }

    // If no publication_id provided, get the active publication
    if (!publicationId) {
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'No active publication found' }, { status: 404 })
      }
      publicationId = newsletter.id
    }

    // Upsert the setting
    const { error } = await supabaseAdmin
      .from('publication_settings')
      .upsert({
        publication_id: publicationId,
        key,
        value: String(value),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'publication_id,key'
      })

    if (error) {
      throw error
    }

    console.log(`[PublicationSettings] Updated ${key}=${value} for publication ${publicationId}`)

    return NextResponse.json({
      success: true,
      key,
      value: String(value),
      publication_id: publicationId
    })
  }
)
