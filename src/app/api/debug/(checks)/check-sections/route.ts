import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check and fix newsletter sections
 *
 * Ensures Advertorial section exists for accounting newsletter
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-sections' },
  async ({ logger }) => {
    // Get accounting newsletter
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id, slug')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        error: 'Newsletter not found'
      }, { status: 404 })
    }

    // Get all sections for this newsletter
    const { data: sections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('publication_id', newsletter.id)
      .order('display_order', { ascending: true })

    // Check if Advertorial section exists
    const advertorialSection = sections?.find(s => s.name === 'Advertorial')

    return NextResponse.json({
      success: true,
      publication_id: newsletter.id,
      newsletter_slug: newsletter.slug,
      sections: sections || [],
      has_advertorial: !!advertorialSection,
      advertorial_section: advertorialSection
    })
  }
)

/**
 * POST to add Advertorial section if missing
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-sections' },
  async ({ logger }) => {
    // Get accounting newsletter
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id, slug')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        error: 'Newsletter not found'
      }, { status: 404 })
    }

    // Check if Advertorial section already exists
    const { data: existingSection } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('publication_id', newsletter.id)
      .eq('name', 'Advertorial')
      .maybeSingle()

    if (existingSection) {
      return NextResponse.json({
        success: true,
        message: 'Advertorial section already exists',
        section: existingSection
      })
    }

    // Get max display_order to add at the end
    const { data: sections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('display_order')
      .eq('publication_id', newsletter.id)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = (sections?.[0]?.display_order || 0) + 1

    // Insert Advertorial section
    const { data: newSection, error: insertError } = await supabaseAdmin
      .from('newsletter_sections')
      .insert({
        publication_id: newsletter.id,
        name: 'Advertorial',
        display_order: nextOrder,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      success: true,
      message: 'Advertorial section added successfully',
      section: newSection
    })
  }
)

export const maxDuration = 60
