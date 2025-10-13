import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Adding Road Work section to newsletter_sections...')

    // First check if it already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('name', 'Road Work')
      .single()

    if (existing && !checkError) {
      return NextResponse.json({
        success: true,
        message: 'Road Work section already exists',
        section: existing
      })
    }

    // Add Road Work section
    const { data: newSection, error: insertError } = await supabaseAdmin
      .from('newsletter_sections')
      .insert({
        name: 'Road Work',
        display_order: 7,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert Road Work section:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to insert Road Work section',
        details: insertError.message
      }, { status: 500 })
    }

    console.log('Road Work section added successfully:', newSection)

    return NextResponse.json({
      success: true,
      message: 'Road Work section added successfully',
      section: newSection
    })

  } catch (error) {
    console.error('Add Road Work section failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add Road Work section',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}