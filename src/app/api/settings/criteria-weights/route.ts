import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

// PATCH - Update criteria weight
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      .from('newsletters')
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

    // Check if setting exists
    const { data: existing } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', key)
      .eq('newsletter_id', newsletterId)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabaseAdmin
        .from('app_settings')
        .update({
          value: weight.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('key', key)
        .eq('newsletter_id', newsletterId)

      if (error) throw error
    } else {
      // Create new
      const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key,
          value: weight.toString(),
          newsletter_id: newsletterId,
          description: `Weight for ${type === 'secondary' ? 'secondary ' : ''}criteria ${criteriaNumber}`
        })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: `Weight for ${type === 'secondary' ? 'secondary ' : ''}criteria ${criteriaNumber} updated to ${weight}`
    })

  } catch (error) {
    console.error('Failed to update criteria weight:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
