import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { callOpenAI, AI_PROMPTS } from '@/lib/openai'

// Helper function to strip HTML tags and decode HTML entities
function decodeHtmlEntities(text: string | null | undefined): string | null {
  if (!text) return null

  // First, strip HTML tags but preserve content
  let cleaned = text
    // Replace <br> tags with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Replace closing </p>, </div>, </li> tags with newlines
    .replace(/<\/(p|div|li)>/gi, '\n')
    // Remove all other HTML tags completely
    .replace(/<[^>]+>/g, '')
    // Replace multiple newlines with double newline
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n').map(line => line.trim()).join('\n')
    .trim()

  // Then decode HTML entities
  return cleaned
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

// Helper function to generate AI event summary
async function generateEventSummary(event: { title: string; description: string | null; venue?: string | null }): Promise<string | null> {
  try {
    if (!event.description || event.description.trim().length < 20) {
      return null // Skip very short descriptions
    }

    console.log(`Generating AI summary for event: ${event.title}`)

    const prompt = await AI_PROMPTS.eventSummarizer({
      title: event.title,
      description: event.description,
      venue: event.venue
    })

    const response = await callOpenAI(prompt, 200, 0.7)

    if (response && response.event_summary) {
      console.log(`Generated summary (${response.word_count} words): ${response.event_summary}`)
      return response.event_summary
    }

    return null
  } catch (error) {
    console.error('Error generating event summary:', error)
    return null
  }
}

interface VisitStCloudEvent {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  venue?: {
    venue: string
    address: string
  }
  url: string
  image?: {
    url: string
  }
  [key: string]: any
}

export async function POST(request: NextRequest) {
  try {
    // Check if this is called from GET with secret (bypass session check)
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const bypassAuth = secret === process.env.CRON_SECRET

    if (!bypassAuth) {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('🔄 Starting events sync from Visit St. Cloud API...')
    const functionStartTime = Date.now()
    console.log('⏰ Function start time:', new Date().toISOString())

    // For testing/manual sync, allow date override from query params
    const overrideStartDate = searchParams.get('start_date')
    const overrideEndDate = searchParams.get('end_date')
    console.log('📅 Date overrides:', { overrideStartDate, overrideEndDate })

    let startDateString, endDateString

    if (overrideStartDate && overrideEndDate) {
      // Use override dates if provided
      startDateString = overrideStartDate
      endDateString = overrideEndDate
      console.log('Using override dates:', startDateString, 'to', endDateString)
    } else {
      // We'll fetch each day individually instead of using a date range
      const startDate = new Date()
      startDateString = startDate.toISOString().split('T')[0]
      endDateString = startDate.toISOString().split('T')[0] // This will be updated in the loop
    }

    // Fetch events from Visit St. Cloud API - using daily calls for better results
    let allEvents: VisitStCloudEvent[] = []

    if (overrideStartDate && overrideEndDate) {
      // If override dates provided, use the original pagination logic for that range
      let page = 1
      let hasMorePages = true
      const perPage = 100

      while (hasMorePages) {
        const apiUrl = `https://www.visitstcloud.com/wp-json/tribe/events/v1/events?start_date=${startDateString}&end_date=${endDateString}&per_page=${perPage}&page=${page}&status=publish`

        console.log(`Fetching page ${page} from:`, apiUrl)

        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'St. Cloud Scoop Newsletter (stcscoop.com)',
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Visit St. Cloud API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        const pageEvents: VisitStCloudEvent[] = data.events || []

        if (pageEvents.length === 0) {
          hasMorePages = false
        } else {
          allEvents = allEvents.concat(pageEvents)
          console.log(`Page ${page}: fetched ${pageEvents.length} events (total so far: ${allEvents.length})`)

          if (pageEvents.length < perPage) {
            hasMorePages = false
          } else {
            page++
          }
        }

        if (page > 50) {
          console.warn('Reached maximum pagination safety limit (50 pages)')
          hasMorePages = false
        }
      }
    } else {
      // For daily sync, fetch each of the next 7 days individually
      console.log('🗓️ Using daily fetch strategy for better results')
      console.log('⏰ Daily fetch start time:', new Date().toISOString())

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date()
        currentDate.setDate(currentDate.getDate() + dayOffset)
        const dayString = currentDate.toISOString().split('T')[0]

        console.log(`📍 Fetching events for day ${dayOffset + 1}/7: ${dayString} at ${new Date().toISOString()}`)

        try {
          const apiUrl = `https://www.visitstcloud.com/wp-json/tribe/events/v1/events?start_date=${dayString}&end_date=${dayString}&per_page=100&status=publish`

          const response = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'St. Cloud Scoop Newsletter (stcscoop.com)',
              'Accept': 'application/json'
            }
          })

          if (!response.ok) {
            console.warn(`API error for ${dayString}: ${response.status} ${response.statusText}`)
            continue // Skip this day and continue with others
          }

          const data = await response.json()
          const dayEvents: VisitStCloudEvent[] = data.events || []

          if (dayEvents.length > 0) {
            allEvents = allEvents.concat(dayEvents)
            console.log(`Day ${dayString}: fetched ${dayEvents.length} events (total so far: ${allEvents.length})`)
          } else {
            console.log(`Day ${dayString}: no events found`)
          }
        } catch (error) {
          console.warn(`Error fetching events for ${dayString}:`, error)
          // Continue with other days even if one fails
        }
      }
    }

    const events = allEvents
    console.log(`✅ Fetched total ${events.length} events from API using daily strategy`)
    console.log('⏰ API fetch complete time:', new Date().toISOString())

    let newEvents = 0
    let updatedEvents = 0
    let errors = 0

    console.log('🔄 Starting event processing loop...')
    console.log('⏰ Event processing start time:', new Date().toISOString())

    // Process events in smaller batches to prevent timeout
    const BATCH_SIZE = 5
    const batches = []

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      batches.push(events.slice(i, i + BATCH_SIZE))
    }

    console.log(`📦 Processing ${events.length} events in ${batches.length} batches of ${BATCH_SIZE}`)

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      console.log(`📊 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} events) at ${new Date().toISOString()}`)

      // Check if we're approaching timeout (leave 60 seconds for cleanup)
      const elapsed = Date.now() - functionStartTime
      if (elapsed > 240000) { // 4 minutes
        console.log(`⏰ Approaching timeout after ${Math.round(elapsed/1000)}s, stopping processing at batch ${batchIndex + 1}`)
        break
      }

      // Process events in current batch
      for (let i = 0; i < batch.length; i++) {
        const apiEvent = batch[i]
        const globalIndex = batchIndex * BATCH_SIZE + i

        console.log(`🔍 Processing event ${globalIndex + 1}/${events.length}: ${apiEvent.title}`)

        try {
        const eventData = {
          external_id: `visitstcloud_${apiEvent.id}`,
          title: decodeHtmlEntities(apiEvent.title) || 'Untitled Event',
          description: decodeHtmlEntities(apiEvent.description),
          start_date: new Date(apiEvent.start_date).toISOString(),
          end_date: apiEvent.end_date ? new Date(apiEvent.end_date).toISOString() : null,
          venue: decodeHtmlEntities(apiEvent.venue?.venue),
          address: decodeHtmlEntities(apiEvent.venue?.address),
          url: apiEvent.url || null,
          website: apiEvent.website || null,
          image_url: apiEvent.image?.url || null,
          featured: false, // Will be set manually
          active: true,
          raw_data: apiEvent,
          updated_at: new Date().toISOString()
        }

        // Check if event already exists and get its status
        console.log(`🔍 Checking existing event ${globalIndex + 1}/${events.length} at ${new Date().toISOString()}`)

        const { data: existingEvent } = await supabaseAdmin
          .from('events')
          .select('id, updated_at, event_summary, featured, paid_placement')
          .eq('external_id', eventData.external_id)
          .single()

        // Generate event summary if needed (for new events or existing events without summaries)
        let eventSummary = null
        const shouldGenerateSummary = !existingEvent || !existingEvent.event_summary

        if (shouldGenerateSummary && eventData.description) {
          eventSummary = await generateEventSummary({
            title: eventData.title,
            description: eventData.description,
            venue: eventData.venue
          })
        }

        // Add event_summary to eventData if generated
        if (eventSummary) {
          (eventData as any).event_summary = eventSummary
        }

        if (existingEvent) {
          // Preserve manual settings (featured, paid_placement) from existing event
          const updateData = {
            ...eventData,
            featured: existingEvent.featured, // Preserve manual featured status
            paid_placement: existingEvent.paid_placement // Preserve manual paid_placement status
          }

          // Update existing event (including new summary if generated)
          const { error: updateError } = await supabaseAdmin
            .from('events')
            .update(updateData)
            .eq('id', existingEvent.id)

          if (updateError) {
            console.error('Error updating event:', updateError)
            errors++
          } else {
            updatedEvents++
          }
        } else {
          // Insert new event
          const { error: insertError } = await supabaseAdmin
            .from('events')
            .insert([eventData])

          if (insertError) {
            console.error('Error inserting event:', insertError)
            errors++
          } else {
            newEvents++
          }
        }
      } catch (error) {
        console.error(`❌ Error processing event ${globalIndex + 1}/${events.length}:`, error)
        errors++
      }
    }

    // Small delay between batches to prevent overwhelming the database
    if (batchIndex < batches.length - 1) {
      console.log(`⏸️ Batch ${batchIndex + 1} complete, pausing 1 second before next batch...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

    console.log('🔄 Processing complete, handling inactive events...')
    console.log('⏰ Deactivation start time:', new Date().toISOString())

    // Only deactivate events that have already ended (are in the past)
    // This prevents deactivating future events that just aren't in today's API fetch window
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString()

    console.log(`📋 Deactivating only events that ended before ${yesterdayStr}`)

    // Get events that have ended and are not in the current API response
    const apiExternalIds = events.map(e => `visitstcloud_${e.id}`)

    if (apiExternalIds.length > 0) {
      // Get event IDs that are currently used in campaigns (protect these)
      const { data: activeCampaignEvents } = await supabaseAdmin
        .from('campaign_events')
        .select('event_id')
        .eq('is_selected', true)

      const protectedEventIds = new Set(activeCampaignEvents?.map(ce => ce.event_id) || [])
      console.log(`🛡️ Protecting ${protectedEventIds.size} events currently used in campaigns`)

      // Get past events that should be deactivated
      const { data: eventsToDeactivate } = await supabaseAdmin
        .from('events')
        .select('id, external_id, end_date, start_date')
        .like('external_id', 'visitstcloud_%')
        .not('external_id', 'in', `(${apiExternalIds.map(id => `'${id}'`).join(',')})`)
        .eq('active', true)
        .lt('end_date', yesterdayStr) // Only events that ended before yesterday

      if (eventsToDeactivate && eventsToDeactivate.length > 0) {
        // Filter out protected events
        const idsToDeactivate = eventsToDeactivate
          .filter(event => !protectedEventIds.has(event.id))
          .map(event => event.id)

        if (idsToDeactivate.length > 0) {
          console.log(`📋 Deactivating ${idsToDeactivate.length} past events (${eventsToDeactivate.length - idsToDeactivate.length} protected)`)

          const { error: deactivateError } = await supabaseAdmin
            .from('events')
            .update({ active: false, updated_at: new Date().toISOString() })
            .in('id', idsToDeactivate)

          if (deactivateError) {
            console.error('Error deactivating old events:', deactivateError)
          }
        } else {
          console.log('📋 All past events in deactivation list are protected by active campaigns')
        }
      } else {
        console.log('📋 No past events found to deactivate')
      }
    }

    console.log(`✅ Events sync complete. New: ${newEvents}, Updated: ${updatedEvents}, Errors: ${errors}`)
    console.log('⏰ Function complete time:', new Date().toISOString())

    return NextResponse.json({
      success: true,
      summary: {
        fetched: events.length,
        new: newEvents,
        updated: updatedEvents,
        errors: errors
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Events sync failed:', error)
    return NextResponse.json({
      error: 'Events sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for manual testing
export async function GET(request: NextRequest) {
  try {
    // Check if secret parameter is provided for manual testing
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized - secret required' }, { status: 401 })
    }

    // Call the POST method
    return POST(request)

  } catch (error) {
    return NextResponse.json({
      error: 'Events sync test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}