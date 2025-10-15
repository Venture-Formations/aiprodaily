import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Debug endpoint to check newsletter sections
export async function GET(request: NextRequest) {
  try {
    const { data: sections, error } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order')

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sections,
      display_order_5: sections?.find(s => s.display_order === 5)
    })

  } catch (error) {
    console.error('Error checking sections:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
