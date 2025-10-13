import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callOpenAI, AI_PROMPTS } from '@/lib/openai'

// Helper function to generate AI event summary
async function generateEventSummary(event: { title: string; description: string | null; venue?: string | null }): Promise<string | null> {
  try {
    if (!event.description || event.description.trim().length < 20) {
      return null
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

export async function GET() {
  try {
    console.log('=== BULK AI SUMMARY GENERATION STARTED ===')

    // Get all events without event_summary (regardless of active status)
    const { data: eventsWithoutSummary, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('id, title, description, venue')
      .is('event_summary', null)
      .not('description', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    console.log(`Found ${eventsWithoutSummary?.length || 0} events without AI summaries`)

    if (!eventsWithoutSummary || eventsWithoutSummary.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No events found that need AI summaries',
        processed: 0,
        successful: 0
      })
    }

    let successful = 0
    let failed = 0

    // Process events in batches
    const batchSize = 5
    for (let i = 0; i < eventsWithoutSummary.length; i += batchSize) {
      const batch = eventsWithoutSummary.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(eventsWithoutSummary.length / batchSize)}`)

      const batchPromises = batch.map(async (event) => {
        try {
          const eventSummary = await generateEventSummary({
            title: event.title,
            description: event.description,
            venue: event.venue
          })

          if (eventSummary) {
            const { error: updateError } = await supabaseAdmin
              .from('events')
              .update({
                event_summary: eventSummary,
                updated_at: new Date().toISOString()
              })
              .eq('id', event.id)

            if (updateError) {
              console.error(`Error updating event ${event.id}:`, updateError)
              return { success: false }
            } else {
              console.log(`✓ Generated summary for: ${event.title}`)
              return { success: true }
            }
          } else {
            return { success: false }
          }
        } catch (error) {
          console.error(`Error processing event:`, error)
          return { success: false }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(result => {
        if (result.success) successful++
        else failed++
      })

      // Delay between batches
      if (i + batchSize < eventsWithoutSummary.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bulk AI summary generation complete',
      processed: eventsWithoutSummary.length,
      successful,
      failed
    })

  } catch (error) {
    console.error('Bulk AI summary generation failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}