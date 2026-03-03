import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/ai-apps/[id] - Get specific AI application
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps/[id]' },
  async ({ request, params }) => {
    const { id } = params
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    let query = supabaseAdmin
      .from('ai_applications')
      .select('id, publication_id, app_name, tagline, description, category, app_url, logo_url, logo_alt, screenshot_url, screenshot_alt, tool_type, category_priority, pinned_position, is_active, is_featured, is_paid_placement, is_affiliate, ai_app_module_id, times_used, last_used_date, created_at, updated_at')
      .eq('id', id)

    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { data: app, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'AI application not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      app
    })
  }
)

/**
 * PATCH /api/ai-apps/[id] - Update AI application
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps/[id]' },
  async ({ request, params }) => {
    const { id } = params
    const body = await request.json()
    const { publication_id, ...updateFields } = body

    // Build update object with validation
    const updates: Record<string, unknown> = {
      ...updateFields,
      updated_at: new Date().toISOString()
    }

    // Validate pinned_position (must be 1-20 or null)
    if ('pinned_position' in updateFields) {
      if (updateFields.pinned_position === null || updateFields.pinned_position === '') {
        updates.pinned_position = null
      } else {
        const position = parseInt(updateFields.pinned_position)
        if (isNaN(position) || position < 1 || position > 20) {
          return NextResponse.json(
            { success: false, error: 'Pinned position must be between 1 and 20' },
            { status: 400 }
          )
        }
        updates.pinned_position = position
      }
    }

    let query = supabaseAdmin
      .from('ai_applications')
      .update(updates)
      .eq('id', id)

    if (publication_id) {
      query = query.eq('publication_id', publication_id)
    }

    const { data: app, error } = await query.select().single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      app
    })
  }
)

/**
 * DELETE /api/ai-apps/[id] - Delete AI application
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps/[id]' },
  async ({ request, params }) => {
    const { id } = params
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    let query = supabaseAdmin
      .from('ai_applications')
      .delete()
      .eq('id', id)

    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'AI application deleted successfully'
    })
  }
)
