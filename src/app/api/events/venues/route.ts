import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all distinct venues from active events
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('venue, address')
      .eq('active', true)
      .not('venue', 'is', null)
      .order('venue')

    if (error) throw error

    // Create unique venues list
    const venuesMap = new Map<string, { name: string; address: string }>()

    events?.forEach(event => {
      if (event.venue) {
        const key = `${event.venue}_${event.address || ''}`
        if (!venuesMap.has(key)) {
          venuesMap.set(key, {
            name: event.venue,
            address: event.address || ''
          })
        }
      }
    })

    const venues = Array.from(venuesMap.values()).map((venue, index) => ({
      id: `${index + 1}`,
      name: venue.name,
      address: venue.address
    }))

    return NextResponse.json({ venues })

  } catch (error) {
    console.error('Failed to load venues:', error)
    return NextResponse.json({
      error: 'Failed to load venues',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
