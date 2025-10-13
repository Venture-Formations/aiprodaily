import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Public endpoint - no authentication required for GET
    // This allows the public events submission page to fetch current pricing

    // Get current pricing settings from database
    const { data: settingsRows, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['public_event_paid_placement_price', 'public_event_featured_price'])

    if (error) {
      throw error
    }

    // Convert rows to object
    const savedSettings: Record<string, string> = {}
    settingsRows?.forEach(row => {
      if (row.key === 'public_event_paid_placement_price') {
        savedSettings.paidPlacementPrice = row.value
      } else if (row.key === 'public_event_featured_price') {
        savedSettings.featuredEventPrice = row.value
      }
    })

    // Return current settings or defaults
    const defaultSettings = {
      paidPlacementPrice: '5',
      featuredEventPrice: '15'
    }

    return NextResponse.json({
      ...defaultSettings,
      ...savedSettings
    })

  } catch (error) {
    console.error('Failed to load public events settings:', error)
    return NextResponse.json({
      error: 'Failed to load public events settings',
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

    const settings = await request.json()

    // Validate required fields and ensure they're positive numbers
    const paidPlacementPrice = parseFloat(settings.paidPlacementPrice)
    const featuredEventPrice = parseFloat(settings.featuredEventPrice)

    if (isNaN(paidPlacementPrice) || paidPlacementPrice < 0) {
      return NextResponse.json({
        error: 'Paid Placement Price must be a valid positive number'
      }, { status: 400 })
    }

    if (isNaN(featuredEventPrice) || featuredEventPrice < 0) {
      return NextResponse.json({
        error: 'Featured Event Price must be a valid positive number'
      }, { status: 400 })
    }

    // Save settings as individual key-value pairs
    const settingsToSave = [
      {
        key: 'public_event_paid_placement_price',
        value: paidPlacementPrice.toFixed(2),
        description: 'Price for paid placement of public event submissions (3 days)'
      },
      {
        key: 'public_event_featured_price',
        value: featuredEventPrice.toFixed(2),
        description: 'Price for featured event status on public submissions (3 days)'
      }
    ]

    // Upsert each setting
    for (const setting of settingsToSave) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })

      if (error) {
        throw error
      }
    }

    // Log the settings update
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            action: 'public_events_pricing_updated',
            details: {
              paid_placement_price: paidPlacementPrice,
              featured_event_price: featuredEventPrice
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Public events pricing saved successfully'
    })

  } catch (error) {
    console.error('Failed to save public events settings:', error)
    return NextResponse.json({
      error: 'Failed to save public events settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
