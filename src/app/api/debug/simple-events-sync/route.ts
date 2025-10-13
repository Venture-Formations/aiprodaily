import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string | null | undefined): string | null {
  if (!text) return null

  return text
    .replace(/&#8217;/g, "'")  // Right single quotation mark
    .replace(/&#8216;/g, "'")  // Left single quotation mark
    .replace(/&#8220;/g, '"')  // Left double quotation mark
    .replace(/&#8221;/g, '"')  // Right double quotation mark
    .replace(/&#8230;/g, '…')  // Horizontal ellipsis
    .replace(/&#8211;/g, '–')  // En dash
    .replace(/&#8212;/g, '—')  // Em dash
    .replace(/&#038;/g, '&')   // Ampersand
    .replace(/&amp;/g, '&')    // Ampersand
    .replace(/&lt;/g, '<')     // Less than
    .replace(/&gt;/g, '>')     // Greater than
    .replace(/&quot;/g, '"')   // Quotation mark
    .replace(/&apos;/g, "'")   // Apostrophe
    .replace(/&nbsp;/g, ' ')   // Non-breaking space
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting SIMPLIFIED events sync test...')
    console.log('⏰ Start time:', new Date().toISOString())

    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized - secret required' }, { status: 401 })
    }

    // Test just one day
    const today = new Date().toISOString().split('T')[0]

    console.log(`📍 Fetching events for today: ${today}`)
    console.log('⏰ API call start:', new Date().toISOString())

    const apiUrl = `https://www.visitstcloud.com/wp-json/tribe/events/v1/events?start_date=${today}&end_date=${today}&per_page=5&status=publish`

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'St. Cloud Scoop Newsletter (stcscoop.com)',
        'Accept': 'application/json'
      }
    })

    console.log('⏰ API call complete:', new Date().toISOString())

    if (!response.ok) {
      throw new Error(`Visit St. Cloud API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const events = data.events || []

    console.log(`✅ Fetched ${events.length} events from API`)
    console.log('⏰ Processing start:', new Date().toISOString())

    let processed = 0

    // Process only first 3 events to test
    for (let i = 0; i < Math.min(events.length, 3); i++) {
      const apiEvent = events[i]

      console.log(`📊 Processing event ${i + 1}/3: ${apiEvent.title}`)
      console.log('⏰ Event process start:', new Date().toISOString())

      const eventData = {
        external_id: `visitstcloud_${apiEvent.id}`,
        title: decodeHtmlEntities(apiEvent.title) || 'Untitled Event',
        description: decodeHtmlEntities(apiEvent.description),
        start_date: new Date(apiEvent.start_date).toISOString(),
        end_date: apiEvent.end_date ? new Date(apiEvent.end_date).toISOString() : null,
        venue: decodeHtmlEntities(apiEvent.venue?.venue),
        address: decodeHtmlEntities(apiEvent.venue?.address),
        url: apiEvent.url || null,
        image_url: apiEvent.image?.url || null,
        featured: false,
        active: true,
        raw_data: apiEvent,
        updated_at: new Date().toISOString()
      }

      console.log('🔍 Checking if event exists...')
      console.log('⏰ DB check start:', new Date().toISOString())

      // Check if event already exists
      const { data: existingEvent } = await supabaseAdmin
        .from('events')
        .select('id, updated_at')
        .eq('external_id', eventData.external_id)
        .single()

      console.log('⏰ DB check complete:', new Date().toISOString())

      if (existingEvent) {
        console.log('🔄 Updating existing event...')
        console.log('⏰ Update start:', new Date().toISOString())

        const { error } = await supabaseAdmin
          .from('events')
          .update(eventData)
          .eq('id', existingEvent.id)

        console.log('⏰ Update complete:', new Date().toISOString())

        if (error) {
          console.error('❌ Update error:', error)
        } else {
          console.log('✅ Updated event')
        }
      } else {
        console.log('➕ Inserting new event...')
        console.log('⏰ Insert start:', new Date().toISOString())

        const { error } = await supabaseAdmin
          .from('events')
          .insert([eventData])

        console.log('⏰ Insert complete:', new Date().toISOString())

        if (error) {
          console.error('❌ Insert error:', error)
        } else {
          console.log('✅ Inserted new event')
        }
      }

      processed++
      console.log(`📊 Completed event ${i + 1}/3`)
      console.log('⏰ Event complete time:', new Date().toISOString())
    }

    console.log('✅ Simplified sync complete!')
    console.log('⏰ Function end time:', new Date().toISOString())

    return NextResponse.json({
      success: true,
      message: 'Simplified events sync completed',
      summary: {
        fetched: events.length,
        processed: processed
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Simplified sync failed:', error)
    console.log('⏰ Error time:', new Date().toISOString())

    return NextResponse.json({
      error: 'Simplified sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}