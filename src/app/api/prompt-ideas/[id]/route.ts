import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/prompt-ideas/[id] - Get specific prompt idea
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Prompt idea not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      prompt
    })

  } catch (error: any) {
    console.error('Failed to fetch prompt idea:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prompt idea', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/prompt-ideas/[id] - Update prompt idea
 */
export async function PATCH(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params
    const body = await request.json()

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      prompt
    })

  } catch (error: any) {
    console.error('Failed to update prompt idea:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update prompt idea', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prompt-ideas/[id] - Delete prompt idea
 */
export async function DELETE(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    const { error } = await supabaseAdmin
      .from('prompt_ideas')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Prompt idea deleted successfully'
    })

  } catch (error: any) {
    console.error('Failed to delete prompt idea:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete prompt idea', details: error.message },
      { status: 500 }
    )
  }
}
