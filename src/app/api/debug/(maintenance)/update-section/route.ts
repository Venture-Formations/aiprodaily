import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Debug endpoint to update a newsletter section
export async function POST(request: NextRequest) {
  try {
    const { display_order, name, is_active } = await request.json()

    if (!display_order) {
      return NextResponse.json({
        success: false,
        error: 'display_order parameter required'
      }, { status: 400 })
    }

    // Get the section
    const { data: section, error: fetchError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('display_order', display_order)
      .single()

    if (fetchError || !section) {
      return NextResponse.json({
        success: false,
        error: 'Section not found',
        details: fetchError?.message
      }, { status: 404 })
    }

    // Build update object
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (is_active !== undefined) updates.is_active = is_active

    // Update it
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_sections')
      .update(updates)
      .eq('id', section.id)

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Updated section at display_order ${display_order}`,
      before: {
        name: section.name,
        is_active: section.is_active
      },
      after: {
        name: name !== undefined ? name : section.name,
        is_active: is_active !== undefined ? is_active : section.is_active
      }
    })

  } catch (error) {
    console.error('Error updating section:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
