import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callOpenAI, AI_PROMPTS } from '@/lib/openai'

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

export async function GET(request: NextRequest) {
  try {
    console.log('=== MANUAL EVENTS SYNC STARTED ===')
    console.log('Time:', new Date().toISOString())

    // Parse query parameters - use dynamic dates like main sync
    const { searchParams } = new URL(request.url)
    const overrideStartDate = searchParams.get('start_date')
    const overrideEndDate = searchParams.get('end_date')

    let startDate, endDate

    if (overrideStartDate && overrideEndDate) {
      startDate = overrideStartDate
      endDate = overrideEndDate
      console.log('Using override dates:', startDate, 'to', endDate)
    } else {
      // Default to today + next 7 days like main sync
      const today = new Date()
      startDate = today.toISOString().split('T')[0]

      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)
      endDate = nextWeek.toISOString().split('T')[0]

      console.log('Using dynamic date range:', startDate, 'to', endDate)
    }

    // Fetch events from Visit St. Cloud API
    const apiUrl = `https://www.visitstcloud.com/wp-json/tribe/events/v1/events?start_date=${startDate}&end_date=${endDate}&per_page=100&status=publish`

    console.log('Fetching from:', apiUrl)

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
    const events: VisitStCloudEvent[] = data.events || []

    console.log(`Fetched ${events.length} events from API`)

    let newEvents = 0
    let updatedEvents = 0
    let errors = 0

    // Process each event
    for (const apiEvent of events) {
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
        console.error('Error processing event:', error)
        errors++
      }
    }

    console.log(`Manual sync complete. New: ${newEvents}, Updated: ${updatedEvents}, Errors: ${errors}`)

    return NextResponse.json({
      success: true,
      summary: {
        fetched: events.length,
        new: newEvents,
        updated: updatedEvents,
        errors: errors,
        dateRange: `${startDate} to ${endDate}`
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Manual events sync failed:', error)
    return NextResponse.json({
      error: 'Manual events sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}