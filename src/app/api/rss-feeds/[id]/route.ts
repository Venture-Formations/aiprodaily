import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

/**
 * GET - Fetch a single RSS feed
 */
export async function GET(request: NextRequest, props: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await props.params
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

  } catch (error) {
    console.error('Get RSS feed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update an RSS feed
 */
export async function PATCH(request: NextRequest, props: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await props.params
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

  } catch (error) {
    console.error('Update RSS feed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete an RSS feed
 */
export async function DELETE(request: NextRequest, props: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await props.params
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

  } catch (error) {
    console.error('Delete RSS feed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
