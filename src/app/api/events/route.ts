import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const active = searchParams.get('active')
    const featured = searchParams.get('featured')

    console.log('Events API called with:', { startDate, endDate, active, featured })

    let query = supabaseAdmin
      .from('events')
      .select('*')
      .order('start_date', { ascending: true })

    // Simplified date filtering - just use start_date for now to debug
    if (startDate) {
      query = query.gte('start_date', startDate)
    }
    if (endDate) {
      // Make endDate inclusive by using lte instead of lt with +1 day
      query = query.lte('start_date', endDate + 'T23:59:59')
    }

    // Filter by active status
    if (active !== null && active !== undefined) {
      query = query.eq('active', active === 'true')
    }

    // Filter by featured status
    if (featured !== null && featured !== undefined) {
      query = query.eq('featured', featured === 'true')
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Events query error:', error)
      throw error
    }

    console.log(`Events API returning ${events?.length || 0} events`)

    return NextResponse.json({
      events: events || [],
      count: events?.length || 0
    })

  } catch (error) {
    console.error('Failed to fetch events:', error)
    return NextResponse.json({
      error: 'Failed to fetch events',
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

    const body = await request.json()
    const {
      title,
      description,
      start_date,
      end_date,
      venue,
      address,
      url,
      image_url,
      featured = false,
      active = true
    } = body

    // Validate required fields
    if (!title || !start_date) {
      return NextResponse.json({
        error: 'Title and start_date are required'
      }, { status: 400 })
    }

    // Generate external_id for manual events
    const external_id = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const eventData = {
      external_id,
      title,
      description: description || null,
      start_date: new Date(start_date).toISOString(),
      end_date: end_date ? new Date(end_date).toISOString() : null,
      venue: venue || null,
      address: address || null,
      url: url || null,
      image_url: image_url || null,
      featured,
      active,
      raw_data: { manual_entry: true, created_by: session.user?.email }
    }

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert([eventData])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ event }, { status: 201 })

  } catch (error) {
    console.error('Failed to create event:', error)
    return NextResponse.json({
      error: 'Failed to create event',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}