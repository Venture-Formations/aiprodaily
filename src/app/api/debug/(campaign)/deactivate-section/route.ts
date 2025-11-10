import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Debug endpoint to deactivate a newsletter section by display_order
export async function POST(request: NextRequest) {
  try {
    const { display_order } = await request.json()

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

    // Deactivate it
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_sections')
      .update({ is_active: false })
      .eq('id', section.id)

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Deactivated section: ${section.name}`,
      section: {
        id: section.id,
        name: section.name,
        display_order: section.display_order,
        was_active: section.is_active,
        now_active: false
      }
    })

  } catch (error) {
    console.error('Error deactivating section:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
