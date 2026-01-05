import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/article-modules/[id] - Get single article module with criteria and prompts
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const { data: module, error } = await supabaseAdmin
      .from('article_modules')
      .select(`
        *,
        criteria:article_module_criteria(*),
        prompts:article_module_prompts(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Article module not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      module
    })

  } catch (error: any) {
    console.error('[ArticleModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch article module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/article-modules/[id] - Update article module
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Build update object with only allowed fields
    const updates: Record<string, any> = {}
    const allowedFields = [
      'name',
      'display_order',
      'is_active',
      'selection_mode',
      'block_order',
      'config',
      'articles_count',
      'lookback_hours',
      'ai_image_prompt'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data: module, error } = await supabaseAdmin
      .from('article_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Article module not found' },
          { status: 404 }
        )
      }
      throw error
    }

    console.log(`[ArticleModules] Updated module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })

  } catch (error: any) {
    console.error('[ArticleModules] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update article module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/article-modules/[id] - Delete article module
 * Also deletes associated criteria, prompts (via CASCADE)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // First, get the module to log info
    const { data: module } = await supabaseAdmin
      .from('article_modules')
      .select('name, publication_id')
      .eq('id', id)
      .single()

    if (!module) {
      return NextResponse.json(
        { error: 'Article module not found' },
        { status: 404 }
      )
    }

    // Unassign RSS feeds from this module
    await supabaseAdmin
      .from('rss_feeds')
      .update({ article_module_id: null })
      .eq('article_module_id', id)

    // Delete the module (criteria and prompts deleted via CASCADE)
    const { error } = await supabaseAdmin
      .from('article_modules')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[ArticleModules] Deleted module: ${module.name} (${id})`)

    return NextResponse.json({
      success: true,
      message: 'Article module deleted'
    })

  } catch (error: any) {
    console.error('[ArticleModules] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete article module', details: error.message },
      { status: 500 }
    )
  }
}
