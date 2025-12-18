import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/settings/publication - Get individual publication setting
 * Query params: key (required), publication_id (optional - defaults to active publication)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

  } catch (error: any) {
    console.error('[PublicationSettings] Failed to fetch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch setting', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/publication - Update publication setting
 * Body: { key, value, publication_id? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

  } catch (error: any) {
    console.error('[PublicationSettings] Failed to update:', error)
    return NextResponse.json(
      { error: 'Failed to update setting', details: error.message },
      { status: 500 }
    )
  }
}
