import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET - Fetch a single RSS feed
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss-feeds/[id]' },
  async ({ params }) => {
    const { id } = params

    const { data: feed, error } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching RSS feed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      feed
    })
  }
)

/**
 * PATCH - Update an RSS feed
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss-feeds/[id]' },
  async ({ params, request }) => {
    const { id } = params
    const body = await request.json()

    // Build update object from provided fields
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (body.url !== undefined) updates.url = body.url
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.active !== undefined) updates.active = body.active
    if (body.use_for_primary_section !== undefined) updates.use_for_primary_section = body.use_for_primary_section
    if (body.use_for_secondary_section !== undefined) updates.use_for_secondary_section = body.use_for_secondary_section

    const { data: feed, error } = await supabaseAdmin
      .from('rss_feeds')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating RSS feed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'RSS feed updated successfully',
      feed
    })
  }
)

/**
 * DELETE - Delete an RSS feed
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss-feeds/[id]' },
  async ({ params }) => {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('rss_feeds')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting RSS feed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'RSS feed deleted successfully'
    })
  }
)
