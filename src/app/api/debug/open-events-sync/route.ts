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
    console.log('🔄 Starting NO-AUTH events sync test...')
    console.log('⏰ Start time:', new Date().toISOString())

    // NO AUTHENTICATION - for debugging only

    // Test just one day
    const today = new Date().toISOString().split('T')[0]

    console.log(`📍 Fetching events for today: ${today}`)
    console.log('⏰ API call start:', new Date().toISOString())

    const apiUrl = `https://www.visitstcloud.com/wp-json/tribe/events/v1/events?start_date=${today}&end_date=${today}&per_page=3&status=publish`

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'St. Cloud Scoop Newsletter (stcscoop.com)',
        'Accept': 'application/json'
      }
    })

    console.log('⏰ API call complete:', new Date().toISOString())
    console.log('🌐 API response status:', response.status)

    if (!response.ok) {
      throw new Error(`Visit St. Cloud API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const events = data.events || []

    console.log(`✅ Fetched ${events.length} events from API`)
    console.log('📊 Events data structure:')
    events.forEach((event: any, index: number) => {
      console.log(`Event ${index + 1}:`, {
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        venue: event.venue?.venue
      })
    })

    console.log('⏰ Processing start:', new Date().toISOString())

    let processed = 0

    // Process only first 2 events to test
    for (let i = 0; i < Math.min(events.length, 2); i++) {
      const apiEvent = events[i]

      console.log(`🔍 Processing event ${i + 1}/2: ${apiEvent.title}`)
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

      console.log('💾 Event data prepared:', {
        external_id: eventData.external_id,
        title: eventData.title,
        start_date: eventData.start_date,
        venue: eventData.venue
      })

      console.log('🔍 Checking if event exists...')
      console.log('⏰ DB check start:', new Date().toISOString())

      try {
        // Check if event already exists
        const { data: existingEvent, error: fetchError } = await supabaseAdmin
          .from('events')
          .select('id, updated_at')
          .eq('external_id', eventData.external_id)
          .single()

        console.log('⏰ DB check complete:', new Date().toISOString())
        console.log('📋 Existing event check result:', {
          found: !!existingEvent,
          error: fetchError?.message
        })

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 is "not found" error, which is expected for new events
          throw fetchError
        }

        if (existingEvent) {
          console.log('🔄 Updating existing event...')
          console.log('⏰ Update start:', new Date().toISOString())

          const { error: updateError } = await supabaseAdmin
            .from('events')
            .update(eventData)
            .eq('id', existingEvent.id)

          console.log('⏰ Update complete:', new Date().toISOString())

          if (updateError) {
            console.error('❌ Update error:', updateError)
            throw updateError
          } else {
            console.log('✅ Updated existing event')
          }
        } else {
          console.log('➕ Inserting new event...')
          console.log('⏰ Insert start:', new Date().toISOString())

          const { error: insertError, data: insertedEvent } = await supabaseAdmin
            .from('events')
            .insert([eventData])
            .select()

          console.log('⏰ Insert complete:', new Date().toISOString())

          if (insertError) {
            console.error('❌ Insert error:', insertError)
            throw insertError
          } else {
            console.log('✅ Inserted new event:', insertedEvent?.[0]?.id)
          }
        }

        processed++
        console.log(`📊 Completed event ${i + 1}/2`)
        console.log('⏰ Event complete time:', new Date().toISOString())

      } catch (dbError) {
        console.error(`❌ Database error for event ${i + 1}:`, dbError)
        throw dbError
      }
    }

    console.log('✅ NO-AUTH sync complete!')
    console.log('⏰ Function end time:', new Date().toISOString())

    return NextResponse.json({
      success: true,
      message: 'NO-AUTH events sync completed successfully',
      summary: {
        fetched: events.length,
        processed: processed
      },
      debug: {
        api_url: apiUrl,
        events_sample: events.map((e: any) => ({
          id: e.id,
          title: e.title,
          start_date: e.start_date
        }))
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ NO-AUTH sync failed:', error)
    console.log('⏰ Error time:', new Date().toISOString())

    return NextResponse.json({
      error: 'NO-AUTH sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}