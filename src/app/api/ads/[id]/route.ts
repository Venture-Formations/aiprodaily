import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET single ad
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    return NextResponse.json({ ad })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch ad',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH - Update ad
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    console.log('[Ads] PATCH request for id:', id)
    console.log('[Ads] Update fields:', Object.keys(body))
    if (body.body) {
      console.log('[Ads] Body content length:', body.body.length, 'chars')
    }

    // Validate required fields if they're being updated
    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    if (body.button_url !== undefined && !body.button_url?.trim()) {
      return NextResponse.json({ error: 'URL cannot be empty' }, { status: 400 })
    }

    // First verify the ad exists and get current values
    const { data: existingAd, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('id, body')
      .eq('id', id)
      .single()

    if (fetchError || !existingAd) {
      console.error('[Ads] Ad not found for update:', id, fetchError)
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 })
    }

    console.log('[Ads] Existing body length:', existingAd.body?.length || 0, 'chars')

    // Perform the update
    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Ads] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!ad) {
      console.error('[Ads] Update returned no data for id:', id)
      return NextResponse.json({ error: 'Update failed - no data returned' }, { status: 500 })
    }

    console.log('[Ads] Successfully updated ad:', id, 'New body length:', ad.body?.length || 0, 'chars')

    // Verify the update actually took effect
    if (body.body && ad.body !== body.body) {
      console.warn('[Ads] WARNING: Body mismatch after update!')
      console.warn('[Ads] Sent:', body.body.substring(0, 100))
      console.warn('[Ads] Got:', ad.body?.substring(0, 100))
    }

    return NextResponse.json({ ad })
  } catch (error) {
    console.error('[Ads] PATCH exception:', error)
    return NextResponse.json({
      error: 'Failed to update ad',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Delete ad
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const { error } = await supabaseAdmin
      .from('advertisements')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to delete ad',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
