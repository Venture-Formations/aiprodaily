import { supabaseAdmin } from '../supabase'
import { AI_CALL } from '../openai'
import { getNewsletterIdFromIssue, logInfo, logError, formatError } from './shared-context'

// Explicit column lists (no select('*'))
const ISSUE_COLS_FOR_EVENTS = `id, publication_id, date`
const EVENT_COLS = `id, title, description, event_summary, start_date, end_date, venue, address, url, website, image_url, original_image_url, cropped_image_url, featured, paid_placement, active, created_at`
const ISSUE_EVENT_COLS = `id, issue_id, event_id, event_date, is_selected, is_featured, display_order, created_at`

/**
 * Utility methods module.
 * Handles welcome section generation, event population, and other utilities.
 */
export class Utils {
  /**
   * Generate welcome section for an issue using AI
   */
  async generateWelcomeSection(issueId: string): Promise<string> {
    try {
      const newsletterId = await getNewsletterIdFromIssue(issueId)

      const { data: moduleArticles, error: articlesError } = await supabaseAdmin
        .from('module_articles')
        .select('headline, content')
        .eq('issue_id', issueId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      if (articlesError) {
        throw articlesError
      }

      if (!moduleArticles || moduleArticles.length === 0) {
        return ''
      }

      let result
      try {
        result = await AI_CALL.welcomeSection(moduleArticles, newsletterId, 500, 0.8)
      } catch (callError) {
        throw new Error(`AI call failed for welcome section: ${callError instanceof Error ? callError.message : 'Unknown error'}`)
      }

      let welcomeIntro = ''
      let welcomeTagline = ''
      let welcomeSummary = ''

      try {
        if (result && typeof result === 'object' && 'raw' in result && typeof result.raw === 'string') {
          try {
            const parsed = JSON.parse(result.raw)
            result = parsed
          } catch (parseError) {
            try {
              const codeFenceMatch = result.raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
              const cleanedContent = codeFenceMatch && codeFenceMatch[1] ? codeFenceMatch[1] : result.raw
              const objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
              if (objectMatch && objectMatch[0]) {
                result = JSON.parse(objectMatch[0])
              } else {
                result = JSON.parse(cleanedContent.trim())
              }
            } catch (fallbackError) {
              throw new Error(`Failed to parse welcome section response: ${JSON.stringify({ raw: result.raw.substring(0, 200), parseError: parseError instanceof Error ? parseError.message : String(parseError) })}`)
            }
          }
        }

        if (typeof result === 'object' && result !== null &&
            ('intro' in result || 'tagline' in result || 'summary' in result)) {
          welcomeIntro = (result as any).intro || ''
          welcomeTagline = (result as any).tagline || ''
          welcomeSummary = (result as any).summary || ''
        } else {
          throw new Error(`Invalid welcome section response: expected object with intro/tagline/summary, got ${typeof result}`)
        }
      } catch (parseError) {
        throw new Error(`Failed to parse welcome section response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      const { error: updateError } = await supabaseAdmin
        .from('publication_issues')
        .update({
          welcome_intro: welcomeIntro,
          welcome_tagline: welcomeTagline,
          welcome_summary: welcomeSummary
        })
        .eq('id', issueId)

      if (updateError) {
        throw updateError
      }

      return `${welcomeIntro} ${welcomeTagline} ${welcomeSummary}`.trim()
    } catch (error) {
      return ''
    }
  }

  /**
   * Smart event population - adds events without clearing existing ones
   */
  async populateEventsForIssueSmart(issueId: string) {
    try {
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select(ISSUE_COLS_FOR_EVENTS)
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        console.error('Failed to fetch issue for event population:', formatError(issueError))
        return
      }

      const issueDate = issue.date

      const baseDate = new Date(issueDate)
      const dates: string[] = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(baseDate)
        date.setDate(baseDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      const { data: existingEvents, error: existingError } = await supabaseAdmin
        .from('issue_events')
        .select(`${ISSUE_EVENT_COLS}, event:events(${EVENT_COLS})`)
        .eq('issue_id', issueId)

      if (existingError) {
        console.error('Error checking existing events:', formatError(existingError))
      }

      const existingEventsByDate: Record<string, any[]> = {}
      if (existingEvents) {
        existingEvents.forEach(ce => {
          const eventDate = ce.event_date
          if (!existingEventsByDate[eventDate]) {
            existingEventsByDate[eventDate] = []
          }
          existingEventsByDate[eventDate].push(ce)
        })
      }

      const startDate = dates[0]
      const endDate = dates[dates.length - 1]

      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select(EVENT_COLS)
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .eq('active', true)
        .order('start_date', { ascending: true })

      if (eventsError) {
        console.error('Failed to fetch available events:', formatError(eventsError))
        return
      }

      if (!availableEvents || availableEvents.length === 0) {
        return
      }

      const eventsByDate: Record<string, any[]> = {}
      availableEvents.forEach(event => {
        const eventDate = event.start_date.split('T')[0]
        if (dates.includes(eventDate)) {
          if (!eventsByDate[eventDate]) {
            eventsByDate[eventDate] = []
          }
          eventsByDate[eventDate].push(event)
        }
      })

      const newIssueEvents: any[] = []

      for (const date of dates) {
        const eventsForDate = eventsByDate[date] || []
        const existingForDate = existingEventsByDate[date] || []

        if (eventsForDate.length === 0) {
          continue
        }

        const alreadySelectedIds = existingForDate.map(ce => ce.event_id)

        const availableForSelection = eventsForDate.filter(event =>
          !alreadySelectedIds.includes(event.id) && event.active === true
        )

        if (availableForSelection.length === 0) {
          continue
        }

        // Remove duplicate titles
        const seenTitles = new Set<string>()
        const uniqueEvents = availableForSelection.filter(event => {
          const titleKey = event.title.toLowerCase().trim()
          if (seenTitles.has(titleKey)) {
            return false
          }
          seenTitles.add(titleKey)
          return true
        })

        const featuredEvents = uniqueEvents.filter(e => e.featured)
        const paidPlacementEvents = uniqueEvents.filter(e => e.paid_placement && !e.featured)
        const regularEvents = uniqueEvents.filter(e => !e.featured && !e.paid_placement)

        const maxEventsPerDay = 8
        const alreadySelected = existingForDate.length
        let remainingSlots = maxEventsPerDay - alreadySelected

        if (remainingSlots <= 0) {
          continue
        }

        const selectedForDate: any[] = []
        let displayOrder = alreadySelected + 1

        featuredEvents.forEach(event => {
          if (remainingSlots > 0) {
            selectedForDate.push({
              event,
              is_featured: true,
              display_order: displayOrder++
            })
            remainingSlots--
          }
        })

        paidPlacementEvents.forEach(event => {
          if (remainingSlots > 0) {
            selectedForDate.push({
              event,
              is_featured: false,
              display_order: displayOrder++
            })
            remainingSlots--
          }
        })

        if (remainingSlots > 0 && regularEvents.length > 0) {
          const shuffled = [...regularEvents].sort(() => Math.random() - 0.5)
          const selectedRegular = shuffled.slice(0, remainingSlots)

          const shouldAutoFeature = featuredEvents.length === 0 && selectedRegular.length > 0

          selectedRegular.forEach((event, index) => {
            selectedForDate.push({
              event,
              is_featured: shouldAutoFeature && index === 0,
              display_order: displayOrder++
            })
          })
        }

        selectedForDate.forEach(({ event, is_featured, display_order }) => {
          newIssueEvents.push({
            issue_id: issueId,
            event_id: event.id,
            event_date: date,
            is_selected: true,
            is_featured,
            display_order
          })
        })
      }

      if (newIssueEvents.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('issue_events')
          .insert(newIssueEvents)

        if (insertError) {
          throw insertError
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error in populateEventsForIssueSmart:', errorMsg)
      await logError('Failed to populate events for issue (smart)', {
        issueId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Event population - clears existing events and re-populates
   */
  async populateEventsForIssue(issueId: string) {
    try {
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select(ISSUE_COLS_FOR_EVENTS)
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        console.error('Failed to fetch issue for event population:', formatError(issueError))
        return
      }

      const newsletterDate = new Date(issue.date + 'T00:00:00')

      const dates = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(newsletterDate)
        date.setDate(newsletterDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      const startDate = dates[0]
      const endDate = dates[dates.length - 1]

      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select(EVENT_COLS)
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .eq('active', true)
        .order('start_date', { ascending: true })

      if (eventsError) {
        console.error('Failed to fetch available events:', formatError(eventsError))
        return
      }

      if (!availableEvents || availableEvents.length === 0) {
        return
      }

      // Clear existing issue events
      const { error: deleteError } = await supabaseAdmin
        .from('issue_events')
        .delete()
        .eq('issue_id', issueId)

      if (deleteError) {
      }

      const eventsByDate: { [key: string]: any[] } = {}

      dates.forEach(date => {
        const dateStart = new Date(date + 'T00:00:00-05:00')
        const dateEnd = new Date(date + 'T23:59:59-05:00')

        const eventsForDate = availableEvents.filter(event => {
          const eventStart = new Date(event.start_date)
          const eventEnd = event.end_date ? new Date(event.end_date) : eventStart
          return (eventStart <= dateEnd && eventEnd >= dateStart)
        })

        if (eventsForDate.length > 0) {
          const featuredEvents = eventsForDate.filter(e => e.featured)
          const paidPlacementEvents = eventsForDate.filter(e => e.paid_placement && !e.featured)
          const regularEvents = eventsForDate.filter(e => !e.featured && !e.paid_placement)

          const guaranteedEvents = [...featuredEvents, ...paidPlacementEvents]
          const baseSlots = 8
          const remainingSlots = Math.max(0, baseSlots - guaranteedEvents.length)

          const shuffledRegular = [...regularEvents].sort(() => Math.random() - 0.5)
          const selectedRegular = shuffledRegular.slice(0, remainingSlots)

          const selectedEvents = [
            ...featuredEvents,
            ...paidPlacementEvents,
            ...selectedRegular
          ]

          eventsByDate[date] = selectedEvents
        }
      })

      const issueEventsData: any[] = []
      let totalSelected = 0

      Object.entries(eventsByDate).forEach(([date, events]) => {
        const dbFeaturedCount = events.filter(e => e.featured).length

        events.forEach((event, index) => {
          let isFeatured = false

          if (event.featured) {
            isFeatured = true
          } else if (dbFeaturedCount === 0 && !event.paid_placement) {
            const nonPaidIndex = events.filter(e => !e.paid_placement).indexOf(event)
            if (nonPaidIndex === 0) {
              isFeatured = true
            }
          }

          issueEventsData.push({
            issue_id: issueId,
            event_id: event.id,
            event_date: date,
            is_selected: true,
            is_featured: isFeatured,
            display_order: index + 1
          })
          totalSelected++
        })
      })

      if (issueEventsData.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('issue_events')
          .insert(issueEventsData)

        if (insertError) {
          return
        }
      }
      await logInfo(`Auto-populated ${totalSelected} events for issue`, {
        issueId,
        totalSelected,
        daysWithEvents: Object.keys(eventsByDate).length,
        dateRange: dates
      })

    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Error in populateEventsForissue:', errorMsg)
      await logError('Failed to auto-populate events for issue', {
        issueId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
