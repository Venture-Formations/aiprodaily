import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { callOpenAI, AI_PROMPTS } from '@/lib/openai'

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== BULK AI SUMMARY GENERATION STARTED ===')
    console.log('Time:', new Date().toISOString())

    // Get all events without event_summary
    const { data: eventsWithoutSummary, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('id, title, description, venue')
      .is('event_summary', null)
      .eq('active', true)
      .not('description', 'is', null)

    if (fetchError) {
      console.error('Error fetching events:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch events',
        message: fetchError.message
      }, { status: 500 })
    }

    console.log(`Found ${eventsWithoutSummary?.length || 0} events without AI summaries`)

    if (!eventsWithoutSummary || eventsWithoutSummary.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No events found that need AI summaries',
        summary: {
          processed: 0,
          successful: 0,
          failed: 0
        }
      })
    }

    let successful = 0
    let failed = 0

    // Process events in batches to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < eventsWithoutSummary.length; i += batchSize) {
      const batch = eventsWithoutSummary.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(eventsWithoutSummary.length / batchSize)} (${batch.length} events)`)

      // Process batch in parallel
      const batchPromises = batch.map(async (event) => {
        try {
          const eventSummary = await generateEventSummary({
            title: event.title,
            description: event.description,
            venue: event.venue
          })

          if (eventSummary) {
            // Update the event with the generated summary
            const { error: updateError } = await supabaseAdmin
              .from('events')
              .update({
                event_summary: eventSummary,
                updated_at: new Date().toISOString()
              })
              .eq('id', event.id)

            if (updateError) {
              console.error(`Error updating event ${event.id}:`, updateError)
              return { success: false, eventId: event.id, error: updateError.message }
            } else {
              console.log(`✓ Generated summary for: ${event.title}`)
              return { success: true, eventId: event.id }
            }
          } else {
            console.log(`⚠ Skipped (no summary generated): ${event.title}`)
            return { success: false, eventId: event.id, error: 'No summary generated' }
          }
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error)
          return { success: false, eventId: event.id, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successful++
        } else {
          failed++
        }
      })

      // Add a small delay between batches to be respectful to the API
      if (i + batchSize < eventsWithoutSummary.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`Bulk AI summary generation complete. Successful: ${successful}, Failed: ${failed}`)

    return NextResponse.json({
      success: true,
      summary: {
        processed: eventsWithoutSummary.length,
        successful: successful,
        failed: failed
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Bulk AI summary generation failed:', error)
    return NextResponse.json({
      error: 'Bulk AI summary generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}