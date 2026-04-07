import type { issueWithArticles, issueEvent, Event } from '@/types/database'
import type { EventDateInfo } from '../types'

export function createEventHandlers(
  getIssue: () => issueWithArticles | null,
  issueEventsRef: () => issueEvent[],
  setissueEvents: React.Dispatch<React.SetStateAction<issueEvent[]>>,
  setAvailableEvents: React.Dispatch<React.SetStateAction<Event[]>>,
  setLoadingEvents: React.Dispatch<React.SetStateAction<boolean>>,
  setUpdatingEvents: React.Dispatch<React.SetStateAction<boolean>>,
  eventsExpandedRef: () => boolean,
  setEventsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const fetchissueEvents = async (issueId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/events`)
      if (response.ok) {
        const data = await response.json()
        setissueEvents(data.issue_events || [])
      }
    } catch (error) {
      console.error('Failed to fetch issue events:', error)
    }
  }

  const fetchAvailableEvents = async (startDate: string, endDate: string) => {
    setLoadingEvents(true)
    try {
      const response = await fetch(`/api/events?start_date=${startDate}&end_date=${endDate}&active=true`)
      if (response.ok) {
        const data = await response.json()
        setAvailableEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch available events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const updateEventSelections = async (eventDate: string, selectedEvents: string[], featuredEvent?: string) => {
    const issue = getIssue()
    if (!issue) return

    setUpdatingEvents(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/events`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_date: eventDate,
          selected_events: selectedEvents,
          featured_event: featuredEvent
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update events')
      }

      await fetchissueEvents(issue.id)

    } catch (error) {
      alert('Failed to update events: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingEvents(false)
    }
  }

  const getEventCountsByDate = (): EventDateInfo[] => {
    const issue = getIssue()
    const issueEvents = issueEventsRef()
    if (!issue) return []

    const newsletterDate = new Date(issue.date + 'T00:00:00')

    const dates: EventDateInfo[] = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      const eventCount = issueEvents.filter(ce =>
        ce.event_date === dateStr && ce.is_selected
      ).length

      let colorClass = 'text-red-600'
      if (eventCount === 8) colorClass = 'text-green-600'
      else if (eventCount > 0) colorClass = 'text-yellow-600'

      dates.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        monthDay: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        count: eventCount,
        colorClass
      })
    }

    return dates
  }

  const handleEventsExpand = () => {
    const issue = getIssue()
    const eventsExpanded = eventsExpandedRef()
    if (!eventsExpanded && issue) {
      const newsletterDate = new Date(issue.date + 'T00:00:00')

      const dates = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(newsletterDate)
        date.setDate(newsletterDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      const startDateStr = dates[0]
      const endDateStr = dates[dates.length - 1]

      console.log('Fetching events with date range:', startDateStr, 'to', endDateStr, 'for newsletter date:', issue.date)
      fetchAvailableEvents(startDateStr, endDateStr)
    }
    setEventsExpanded(!eventsExpanded)
  }

  return {
    fetchissueEvents,
    fetchAvailableEvents,
    updateEventSelections,
    getEventCountsByDate,
    handleEventsExpand,
  }
}
