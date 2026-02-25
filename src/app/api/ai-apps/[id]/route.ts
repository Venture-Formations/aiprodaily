import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/ai-apps/[id] - Get specific AI application
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps/[id]' },
  async ({ params }) => {
    const { id } = params

    const { data: app, error } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('id', id)
      .single()

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

    // Build update object with validation
    const updates: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString()
    }

    // Validate pinned_position (must be 1-20 or null)
    if ('pinned_position' in body) {
      if (body.pinned_position === null || body.pinned_position === '') {
        updates.pinned_position = null
      } else {
        const position = parseInt(body.pinned_position)
        if (isNaN(position) || position < 1 || position > 20) {
          return NextResponse.json(
            { success: false, error: 'Pinned position must be between 1 and 20' },
            { status: 400 }
          )
        }
        updates.pinned_position = position
      }
    }

    const { data: app, error } = await supabaseAdmin
      .from('ai_applications')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

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
  async ({ params }) => {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('ai_applications')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'AI application deleted successfully'
    })
  }
)
