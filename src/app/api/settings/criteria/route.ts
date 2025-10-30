import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

// GET - Fetch criteria configuration (enabled count and names)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletterSlug = searchParams.get('newsletter_id')

    if (!newsletterSlug) {
      return NextResponse.json(
        { error: 'newsletter_id is required' },
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

    // Fetch criteria enabled count
    const { data: enabledData } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'criteria_enabled_count')
      .eq('newsletter_id', newsletterId)
      .single()

    const enabledCount = enabledData?.value ? parseInt(enabledData.value) : 3

    // Fetch all criteria names and weights (both primary and secondary)
    const { data: settingsData } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('newsletter_id', newsletterId)
      .or('key.like.criteria_%_name,key.like.criteria_%_weight,key.like.secondary_criteria_%_weight,key.like.secondary_criteria_%_name')

    const criteria = []
    for (let i = 1; i <= 5; i++) {
      const nameKey = `criteria_${i}_name`
      const weightKey = `criteria_${i}_weight`
      const secondaryNameKey = `secondary_criteria_${i}_name`
      const secondaryWeightKey = `secondary_criteria_${i}_weight`

      const nameRecord = settingsData?.find(s => s.key === nameKey)
      const weightRecord = settingsData?.find(s => s.key === weightKey)
      const secondaryNameRecord = settingsData?.find(s => s.key === secondaryNameKey)
      const secondaryWeightRecord = settingsData?.find(s => s.key === secondaryWeightKey)

      criteria.push({
        number: i,
        name: nameRecord?.value || `Criteria ${i}`,
        weight: weightRecord?.value ? parseFloat(weightRecord.value) : 1.0,
        secondaryName: secondaryNameRecord?.value || nameRecord?.value || `Criteria ${i}`,
        secondaryWeight: secondaryWeightRecord?.value ? parseFloat(secondaryWeightRecord.value) : 1.0,
        enabled: i <= enabledCount
      })
    }

    return NextResponse.json({
      success: true,
      enabledCount,
      criteria
    })

  } catch (error) {
    console.error('Failed to fetch criteria configuration:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH - Update criteria configuration
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, criteriaNumber, name, enabledCount, isSecondary, newsletterSlug } = body

    if (!newsletterSlug) {
      return NextResponse.json(
        { error: 'newsletterSlug is required' },
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

    if (action === 'update_name') {
      if (!criteriaNumber || !name) {
        return NextResponse.json(
          { error: 'Criteria number and name are required' },
          { status: 400 }
        )
      }

      // Use different keys for primary vs secondary criteria
      const key = isSecondary
        ? `secondary_criteria_${criteriaNumber}_name`
        : `criteria_${criteriaNumber}_name`

      // Check if setting exists
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('key')
        .eq('key', key)
        .eq('newsletter_id', newsletterId)
        .single()

      let error
      if (existing) {
        // Update existing
        const result = await supabaseAdmin
          .from('app_settings')
          .update({
            value: name,
            updated_at: new Date().toISOString()
          })
          .eq('key', key)
          .eq('newsletter_id', newsletterId)
        error = result.error
      } else {
        // Insert new
        const result = await supabaseAdmin
          .from('app_settings')
          .insert({
            key,
            value: name,
            newsletter_id: newsletterId,
            description: `Name for ${isSecondary ? 'secondary' : 'primary'} criteria ${criteriaNumber}`
          })
        error = result.error
      }

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      const criteriaType = isSecondary ? 'Secondary criteria' : 'Criteria'
      return NextResponse.json({
        success: true,
        message: `${criteriaType} ${criteriaNumber} name updated to "${name}"`
      })
    }

    if (action === 'set_enabled_count') {
      if (enabledCount === undefined || enabledCount < 1 || enabledCount > 5) {
        return NextResponse.json(
          { error: 'Enabled count must be between 1 and 5' },
          { status: 400 }
        )
      }

      // Check if criteria_enabled_count exists
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('key')
        .eq('key', 'criteria_enabled_count')
        .eq('newsletter_id', newsletterId)
        .single()

      let error
      if (existing) {
        // Update existing
        const result = await supabaseAdmin
          .from('app_settings')
          .update({
            value: enabledCount.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('key', 'criteria_enabled_count')
          .eq('newsletter_id', newsletterId)
        error = result.error
      } else {
        // Insert new
        const result = await supabaseAdmin
          .from('app_settings')
          .insert({
            key: 'criteria_enabled_count',
            value: enabledCount.toString(),
            newsletter_id: newsletterId,
            description: 'Number of criteria currently enabled (1-5)'
          })
        error = result.error
      }

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      return NextResponse.json({
        success: true,
        message: `Enabled criteria count set to ${enabledCount}`,
        enabledCount
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Failed to update criteria configuration:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
