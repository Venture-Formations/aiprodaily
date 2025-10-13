import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch active newsletter sections ordered by display_order
    const { data: sections, error } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      sections: sections || []
    })

  } catch (error) {
    console.error('Failed to fetch newsletter sections:', error)
    return NextResponse.json({
      error: 'Failed to fetch newsletter sections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Handle section order updates
    if (body.sections && Array.isArray(body.sections)) {
      // Update display order for multiple sections
      const { sections } = body

      for (const section of sections) {
        if (!section.id || typeof section.display_order !== 'number') {
          return NextResponse.json({
            error: 'Invalid section data. Each section must have id and display_order.'
          }, { status: 400 })
        }

        const { error } = await supabaseAdmin
          .from('newsletter_sections')
          .update({ display_order: section.display_order })
          .eq('id', section.id)

        if (error) {
          throw error
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Section order updated successfully'
      })
    }

    // Handle single section status update
    if (body.section_id && typeof body.is_active === 'boolean') {
      const { section_id, is_active } = body

      const { error } = await supabaseAdmin
        .from('newsletter_sections')
        .update({ is_active })
        .eq('id', section_id)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        message: `Section ${is_active ? 'activated' : 'deactivated'} successfully`
      })
    }

    return NextResponse.json({
      error: 'Invalid request body. Expected sections array or section_id with is_active.'
    }, { status: 400 })

  } catch (error) {
    console.error('Failed to update newsletter sections:', error)
    return NextResponse.json({
      error: 'Failed to update newsletter sections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, display_order = 999, is_active = true } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({
        error: 'Section name is required'
      }, { status: 400 })
    }

    // Check if section with this name already exists
    const { data: existingSection } = await supabaseAdmin
      .from('newsletter_sections')
      .select('id')
      .eq('name', name)
      .single()

    if (existingSection) {
      return NextResponse.json({
        error: 'A section with this name already exists'
      }, { status: 400 })
    }

    // Create new section
    const { data: newSection, error } = await supabaseAdmin
      .from('newsletter_sections')
      .insert([{
        name,
        display_order,
        is_active
      }])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      section: newSection,
      message: 'Newsletter section created successfully'
    })

  } catch (error) {
    console.error('Failed to create newsletter section:', error)
    return NextResponse.json({
      error: 'Failed to create newsletter section',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}