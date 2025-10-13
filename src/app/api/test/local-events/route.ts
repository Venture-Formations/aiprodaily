import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function generateLocalEventsSection(): Promise<string> {
  try {
    console.log('Testing Local Events section generation...')

    // Calculate a 3-day range starting from today for testing
    const today = new Date()
    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    console.log('Testing with dates:', dates)

    // Fetch events for the calculated date range
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    const { data: availableEvents, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (error) {
      console.error('Error fetching events:', error)
      return `<div style="color: red; padding: 20px;">Error fetching events: ${error.message}</div>`
    }

    if (!availableEvents || availableEvents.length === 0) {
      // Create test data for demonstration
      const testEvents = [
        {
          id: 'test-1',
          title: 'Test Community Festival',
          description: 'A fun community gathering with food trucks, live music, and activities for the whole family.',
          event_summary: 'Join us for a day of community fun with food, music, and family activities.',
          start_date: dates[0] + 'T18:00:00',
          end_date: dates[0] + 'T22:00:00',
          venue: 'Community Park',
          address: '123 Main St, St. Cloud, MN',
          url: 'https://example.com/festival',
          featured: true
        },
        {
          id: 'test-2',
          title: 'Test Art Gallery Opening',
          description: 'Opening reception for local artist showcase featuring works from regional talent.',
          event_summary: 'Celebrate local artists with an opening reception featuring regional artwork.',
          start_date: dates[1] + 'T19:00:00',
          end_date: dates[1] + 'T21:00:00',
          venue: 'Downtown Gallery',
          address: '456 Art St, St. Cloud, MN',
          url: 'https://example.com/gallery',
          featured: false
        },
        {
          id: 'test-3',
          title: 'Test Farmers Market',
          description: 'Weekly farmers market with fresh produce, baked goods, and handmade crafts.',
          event_summary: 'Shop fresh, local produce and handmade goods at the weekly farmers market.',
          start_date: dates[2] + 'T08:00:00',
          end_date: dates[2] + 'T14:00:00',
          venue: 'Market Square',
          address: '789 Market Ave, St. Cloud, MN',
          url: 'https://example.com/market',
          featured: false
        }
      ]

      console.log('No events found, using test data')

      // Generate HTML with test data
      const dayColumns = dates.map((date, index) => {
        const event = testEvents[index]
        if (!event) return ''

        const eventDate = new Date(event.start_date)
        const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' })
        const monthDay = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        const featuredHtml = event.featured ? `
          <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="padding: 12px;">
              <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: #1877F2;">${event.title}</h4>
              <p style="margin: 0 0 8px; font-size: 14px; color: #555; line-height: 1.4;">${event.event_summary || event.description}</p>
              <div style="font-size: 12px; color: #666;">
                <div style="margin-bottom: 4px;"><strong>Venue:</strong> ${event.venue}</div>
                <div style="margin-bottom: 4px;"><strong>Time:</strong> ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                ${event.url ? `<div><a href="${event.url}" style="color: #1877F2; text-decoration: none;">Learn More →</a></div>` : ''}
              </div>
            </div>
          </div>` : ''

        const regularHtml = !event.featured ? `
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 6px; padding: 8px;">
            <div style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 4px;">${event.title}</div>
            <div style="font-size: 12px; color: #666;">
              <div>${event.venue} • ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
            </div>
          </div>` : ''

        return `
<td style="width: 33.33%; vertical-align: top; padding: 8px;">
  <div style="background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; height: 100%; overflow: hidden;">
    <div style="background-color: #1877F2; color: white; text-align: center; padding: 8px; font-weight: bold;">
      <div style="font-size: 18px;">${dayName}</div>
      <div style="font-size: 14px;">${monthDay}</div>
    </div>
    <div style="padding: 8px; min-height: 200px;">
      ${featuredHtml}
      ${regularHtml}
    </div>
  </div>
</td>`
      }).join(' ')

      return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Events (TEST DATA)</h2>
    </td>
  </tr>
  <tr class="row">${dayColumns}</tr>
</table>
<br>`
    }

    console.log(`Found ${availableEvents.length} events for testing`)

    // Use real events data - group by date
    const eventsByDate: { [key: string]: any[] } = {}

    dates.forEach(date => {
      const dateStart = new Date(date + 'T00:00:00-05:00')
      const dateEnd = new Date(date + 'T23:59:59-05:00')

      const eventsForDate = availableEvents.filter(event => {
        const eventStart = new Date(event.start_date)
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart
        return (eventStart <= dateEnd && eventEnd >= dateStart)
      })

      eventsByDate[date] = eventsForDate.slice(0, 6) // Max 6 events per day for testing
    })

    const dayColumns = dates.map(date => {
      const events = eventsByDate[date] || []
      const dateObj = new Date(date)
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
      const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      const featuredEvents = events.filter(e => e.featured).slice(0, 1)
      const regularEvents = events.filter(e => !e.featured).slice(0, 5)

      const featuredHtml = featuredEvents.map(event => {
        const eventDate = new Date(event.start_date)
        return `
          <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="padding: 12px;">
              <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: #1877F2;">${event.title}</h4>
              <p style="margin: 0 0 8px; font-size: 14px; color: #555; line-height: 1.4;">${event.event_summary || event.description}</p>
              <div style="font-size: 12px; color: #666;">
                <div style="margin-bottom: 4px;"><strong>Venue:</strong> ${event.venue || 'TBA'}</div>
                <div style="margin-bottom: 4px;"><strong>Time:</strong> ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                ${event.url ? `<div><a href="${event.url}" style="color: #1877F2; text-decoration: none;">Learn More →</a></div>` : ''}
              </div>
            </div>
          </div>`
      }).join('')

      const regularEventsHtml = regularEvents.map(event => {
        const eventDate = new Date(event.start_date)
        return `
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 6px; padding: 8px;">
            <div style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 4px;">${event.title}</div>
            <div style="font-size: 12px; color: #666;">
              <div>${event.venue || 'TBA'} • ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
            </div>
          </div>`
      }).join('')

      return `
<td style="width: 33.33%; vertical-align: top; padding: 8px;">
  <div style="background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; height: 100%; overflow: hidden;">
    <div style="background-color: #1877F2; color: white; text-align: center; padding: 8px; font-weight: bold;">
      <div style="font-size: 18px;">${dayName}</div>
      <div style="font-size: 14px;">${monthDay}</div>
    </div>
    <div style="padding: 8px; min-height: 200px;">
      ${featuredHtml}
      ${regularEventsHtml}
      ${events.length === 0 ? '<div style="text-align: center; color: #999; font-style: italic; padding: 20px;">No events scheduled</div>' : ''}
    </div>
  </div>
</td>`
    }).join(' ')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Events</h2>
    </td>
  </tr>
  <tr class="row">${dayColumns}</tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Local Events section:', error)
    return `<div style="color: red; padding: 20px;">Error generating Local Events section: ${error instanceof Error ? error.message : 'Unknown error'}</div>`
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📅 Testing Local Events section generation...')

    const html = await generateLocalEventsSection()

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Local Events test endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}