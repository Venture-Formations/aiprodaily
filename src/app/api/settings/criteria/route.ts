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

    // Fetch criteria enabled count
    const { data: enabledData } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'criteria_enabled_count')
      .single()

    const enabledCount = enabledData?.value ? parseInt(enabledData.value) : 3

    // Fetch all criteria names and weights
    const { data: settingsData } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.like.criteria_%_name,key.like.criteria_%_weight')

    const criteria = []
    for (let i = 1; i <= 5; i++) {
      const nameKey = `criteria_${i}_name`
      const weightKey = `criteria_${i}_weight`

      const nameRecord = settingsData?.find(s => s.key === nameKey)
      const weightRecord = settingsData?.find(s => s.key === weightKey)

      criteria.push({
        number: i,
        name: nameRecord?.value || `Criteria ${i}`,
        weight: weightRecord?.value ? parseFloat(weightRecord.value) : 1.0,
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
    const { action, criteriaNumber, name, enabledCount } = body

    if (action === 'update_name') {
      if (!criteriaNumber || !name) {
        return NextResponse.json(
          { error: 'Criteria number and name are required' },
          { status: 400 }
        )
      }

      const key = `criteria_${criteriaNumber}_name`

      // Check if setting exists
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('key')
        .eq('key', key)
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
        error = result.error
      } else {
        // Insert new
        const result = await supabaseAdmin
          .from('app_settings')
          .insert({
            key,
            value: name,
            description: `Name for criteria ${criteriaNumber}`
          })
        error = result.error
      }

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      return NextResponse.json({
        success: true,
        message: `Criteria ${criteriaNumber} name updated to "${name}"`
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
        error = result.error
      } else {
        // Insert new
        const result = await supabaseAdmin
          .from('app_settings')
          .insert({
            key: 'criteria_enabled_count',
            value: enabledCount.toString(),
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
