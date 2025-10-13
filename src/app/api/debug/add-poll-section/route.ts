import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if Poll section already exists
    const { data: existing } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('name', 'Poll')
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Poll section already exists',
        section: existing
      })
    }

    // Create Poll section with display_order 8 (after Road Work which is 7)
    const { data: newSection, error } = await supabaseAdmin
      .from('newsletter_sections')
      .insert([{
        name: 'Poll',
        display_order: 8,
        is_active: true
      }])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Poll section created successfully',
      section: newSection
    })

  } catch (error) {
    console.error('Error adding Poll section:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
