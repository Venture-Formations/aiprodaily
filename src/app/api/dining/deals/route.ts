import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { DiningDeal } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: deals, error } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching dining deals:', error)
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }

    return NextResponse.json({ deals: deals || [] })
  } catch (error) {
    console.error('Dining deals API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      business_name,
      business_address,
      google_profile,
      day_of_week,
      special_description,
      special_time,
      is_featured
    } = body

    // Validate required fields
    if (!business_name || !day_of_week || !special_description) {
      return NextResponse.json(
        { error: 'Missing required fields: business_name, day_of_week, special_description' },
        { status: 400 }
      )
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    if (!validDays.includes(day_of_week)) {
      return NextResponse.json(
        { error: 'Invalid day_of_week. Must be one of: ' + validDays.join(', ') },
        { status: 400 }
      )
    }

    const { data: deal, error } = await supabaseAdmin
      .from('dining_deals')
      .insert([{
        business_name,
        business_address,
        google_profile,
        day_of_week,
        special_description,
        special_time,
        is_featured: Boolean(is_featured),
        is_active: true
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating dining deal:', error)
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
    }

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error('Dining deal creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}