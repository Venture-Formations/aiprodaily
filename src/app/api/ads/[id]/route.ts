import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// GET single ad
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'ads/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    let query = supabaseAdmin
      .from('advertisements')
      .select('id, publication_id, advertiser_id, title, body, image_url, image_alt, button_text, button_url, company_name, status, start_date, end_date, is_active, priority, times_shown, last_shown_at, created_at, updated_at')
      .eq('id', id)

    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { data: ad, error } = await query.single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    return NextResponse.json({ ad })
  }
)

// PATCH - Update ad
export const PATCH = withApiHandler(
  { authTier: 'admin', logContext: 'ads/[id]' },
  async ({ params, request, logger }) => {
    const id = params.id
    const body = await request.json()

    logger.info({ adId: id, fields: Object.keys(body) }, 'PATCH request')
    if (body.body) {
      logger.info({ bodyLength: body.body.length }, 'Body content length')
    }

    // Validate required fields if they're being updated
    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    if (body.button_url !== undefined && !body.button_url?.trim()) {
      return NextResponse.json({ error: 'URL cannot be empty' }, { status: 400 })
    }

    // Normalize URL: ensure https:// prefix
    if (body.button_url) {
      let normalizedUrl = body.button_url.trim()
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl
      }
      body.button_url = normalizedUrl
    }

    // First verify the ad exists and get current values
    const { publication_id: _pubId, ...updateBody } = body
    const { data: existingAd, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('id, body, publication_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingAd) {
      logger.error({ adId: id, err: fetchError }, 'Ad not found for update')
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 })
    }

    // Perform the update (scoped to the ad's publication)
    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .update({
        ...updateBody,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('publication_id', existingAd.publication_id)
      .select()
      .single()

    if (error) {
      logger.error({ err: error }, 'Update error')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!ad) {
      logger.error({ adId: id }, 'Update returned no data')
      return NextResponse.json({ error: 'Update failed - no data returned' }, { status: 500 })
    }

    logger.info({ adId: id, newBodyLength: ad.body?.length || 0 }, 'Successfully updated ad')

    // Verify the update actually took effect
    if (body.body && ad.body !== body.body) {
      logger.warn({ adId: id }, 'Body mismatch after update')
    }

    return NextResponse.json({ ad })
  }
)

// DELETE - Delete ad
export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'ads/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    let query = supabaseAdmin
      .from('advertisements')
      .delete()
      .eq('id', id)

    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
