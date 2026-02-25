import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH - Update criteria weight
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/criteria-weights' },
  async ({ request }) => {
    const body = await request.json()
    const { criteriaNumber, weight, type, newsletterSlug } = body

    if (!newsletterSlug) {
      return NextResponse.json(
        { error: 'newsletterSlug is required' },
        { status: 400 }
      )
    }

    if (!criteriaNumber || weight === undefined) {
      return NextResponse.json(
        { error: 'Criteria number and weight are required' },
        { status: 400 }
      )
    }

    // Convert slug to UUID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', newsletterSlug)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    const newsletterId = newsletter.id

    const weightNum = parseFloat(weight)
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 10) {
      return NextResponse.json(
        { error: 'Weight must be a number between 0 and 10' },
        { status: 400 }
      )
    }

    // Use separate weight storage for primary and secondary criteria
    const key = type === 'secondary'
      ? `secondary_criteria_${criteriaNumber}_weight`
      : `criteria_${criteriaNumber}_weight`

    // Upsert the weight setting
    const { error } = await supabaseAdmin
      .from('publication_settings')
      .upsert({
        key,
        value: weight.toString(),
        publication_id: newsletterId,
        description: `Weight for ${type === 'secondary' ? 'secondary ' : ''}criteria ${criteriaNumber}`,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'publication_id,key'
      })

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Weight for ${type === 'secondary' ? 'secondary ' : ''}criteria ${criteriaNumber} updated to ${weight}`
    })
  }
)
