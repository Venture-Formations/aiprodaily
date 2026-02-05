import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/ai-apps/[id] - Get specific AI application
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
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

  } catch (error: any) {
    console.error('Failed to fetch AI application:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI application', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai-apps/[id] - Update AI application
 */
export async function PATCH(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
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

  } catch (error: any) {
    console.error('Failed to update AI application:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update AI application', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai-apps/[id] - Delete AI application
 */
export async function DELETE(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
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

  } catch (error: any) {
    console.error('Failed to delete AI application:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete AI application', details: error.message },
      { status: 500 }
    )
  }
}
