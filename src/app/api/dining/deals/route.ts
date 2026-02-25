import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'dining/deals' },
  async ({ logger }) => {
    const { data: deals, error } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error({ err: error }, 'Error fetching dining deals')
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }

    return NextResponse.json({ deals: deals || [] })
  }
)

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'dining/deals' },
  async ({ request, logger }) => {
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
      logger.error({ err: error }, 'Error creating dining deal')
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
    }

    return NextResponse.json({ deal }, { status: 201 })
  }
)
