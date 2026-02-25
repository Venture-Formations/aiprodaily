import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/newsletter-sections' },
  async () => {
    // Fetch all newsletter sections ordered by display_order
    const { data: sections, error } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      sections: sections || []
    })
  }
)

export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/newsletter-sections' },
  async ({ request }) => {
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

    // Handle section name update
    if (body.section_id && body.name !== undefined) {
      const { section_id, name } = body

      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({
          error: 'Section name cannot be empty'
        }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('newsletter_sections')
        .update({ name: name.trim() })
        .eq('id', section_id)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        message: 'Section name updated successfully'
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
  }
)

export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/newsletter-sections' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('id')

    if (!sectionId) {
      return NextResponse.json({
        error: 'Section ID is required'
      }, { status: 400 })
    }

    // Get section info before deleting
    const { data: section } = await supabaseAdmin
      .from('newsletter_sections')
      .select('name')
      .eq('id', sectionId)
      .single()

    // Delete the section
    const { error } = await supabaseAdmin
      .from('newsletter_sections')
      .delete()
      .eq('id', sectionId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `Section "${section?.name || sectionId}" deleted successfully`
    })
  }
)

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/newsletter-sections' },
  async ({ request }) => {
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
  }
)
