import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/article-modules/[id]/feeds - List feeds assigned to a module
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params

    // Get module to verify it exists and get publication_id
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('article_modules')
      .select('id, publication_id')
      .eq('id', moduleId)
      .single()

    if (moduleError || !module) {
      return NextResponse.json(
        { error: 'Article module not found' },
        { status: 404 }
      )
    }

    // Get assigned feeds
    const { data: assignedFeeds, error: assignedError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, url, active, last_fetched_at')
      .eq('article_module_id', moduleId)
      .order('name', { ascending: true })

    if (assignedError) throw assignedError

    // Get unassigned feeds (available to assign)
    const { data: unassignedFeeds, error: unassignedError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, url, active, last_fetched_at')
      .eq('publication_id', module.publication_id)
      .is('article_module_id', null)
      .order('name', { ascending: true })

    if (unassignedError) throw unassignedError

    return NextResponse.json({
      success: true,
      assigned: assignedFeeds || [],
      available: unassignedFeeds || []
    })

  } catch (error: any) {
    console.error('[ArticleModuleFeeds] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feeds', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/article-modules/[id]/feeds - Assign or unassign feeds
 * Body: { assign: [feed_ids], unassign: [feed_ids] }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params
    const body = await request.json()

    // Verify module exists
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('article_modules')
      .select('id, publication_id')
      .eq('id', moduleId)
      .single()

    if (moduleError || !module) {
      return NextResponse.json(
        { error: 'Article module not found' },
        { status: 404 }
      )
    }

    let assignedCount = 0
    let unassignedCount = 0

    // Unassign feeds first (set article_module_id to null)
    if (body.unassign && Array.isArray(body.unassign) && body.unassign.length > 0) {
      const { error: unassignError, count } = await supabaseAdmin
        .from('rss_feeds')
        .update({ article_module_id: null })
        .eq('article_module_id', moduleId)
        .in('id', body.unassign)

      if (unassignError) throw unassignError
      unassignedCount = count || 0
    }

    // Assign feeds (set article_module_id to this module)
    // Only assign feeds that belong to the same publication and are currently unassigned
    if (body.assign && Array.isArray(body.assign) && body.assign.length > 0) {
      const { error: assignError, count } = await supabaseAdmin
        .from('rss_feeds')
        .update({ article_module_id: moduleId })
        .eq('publication_id', module.publication_id)
        .is('article_module_id', null)
        .in('id', body.assign)

      if (assignError) throw assignError
      assignedCount = count || 0
    }

    console.log(`[ArticleModuleFeeds] Module ${moduleId}: assigned ${assignedCount}, unassigned ${unassignedCount}`)

    // Return updated feed lists
    const { data: assignedFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, url, active, last_fetched_at')
      .eq('article_module_id', moduleId)
      .order('name', { ascending: true })

    const { data: unassignedFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, url, active, last_fetched_at')
      .eq('publication_id', module.publication_id)
      .is('article_module_id', null)
      .order('name', { ascending: true })

    return NextResponse.json({
      success: true,
      message: `Assigned ${assignedCount} feeds, unassigned ${unassignedCount} feeds`,
      assigned: assignedFeeds || [],
      available: unassignedFeeds || []
    })

  } catch (error: any) {
    console.error('[ArticleModuleFeeds] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update feed assignments', details: error.message },
      { status: 500 }
    )
  }
}
