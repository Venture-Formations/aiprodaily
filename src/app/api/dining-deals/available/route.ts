import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const day = searchParams.get('day')

    if (!day) {
      return NextResponse.json({ error: 'Day parameter is required' }, { status: 400 })
    }

    console.log('Fetching dining deals for day:', day)

    // Fetch dining deals for the specified day of week
    const { data: deals, error } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .eq('day_of_week', day)
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('business_name', { ascending: true })

    if (error) {
      console.error('Error fetching dining deals:', error)
      return NextResponse.json({ error: 'Failed to fetch dining deals' }, { status: 500 })
    }

    console.log(`Found ${deals?.length || 0} dining deals for ${day}`)

    return NextResponse.json({
      success: true,
      day,
      deals: deals || [],
      count: deals?.length || 0
    })

  } catch (error) {
    console.error('Error in dining deals available API:', error)
    return NextResponse.json({
      error: 'Failed to fetch available dining deals',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}