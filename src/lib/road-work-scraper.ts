import { RoadWorkItem } from '@/types/database'

/**
 * Scrape road work data from known government sources
 * This replicates the Make/ChatGPT approach without using Make
 */

interface ScrapedRoadWork {
  items: RoadWorkItem[]
  source: string
}

/**
 * Fetch and parse St. Cloud city road construction page
 */
async function scrapeStCloudRoadWork(): Promise<ScrapedRoadWork> {
  const items: RoadWorkItem[] = []

  try {
    console.log('Scraping St. Cloud city road work...')

    const response = await fetch('https://www.ci.stcloud.mn.us/307/Road-Construction-Projects', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Parse the HTML using regex patterns for common project formats
    // This is a simplified approach - real implementation would use a proper HTML parser
    console.log('St. Cloud page fetched, length:', html.length)

    // For now, return empty - we'll enhance this with proper parsing
    return { items, source: 'St. Cloud City' }

  } catch (error) {
    console.error('Failed to scrape St. Cloud road work:', error)
    return { items, source: 'St. Cloud City' }
  }
}

/**
 * Fetch and parse Stearns County road construction page
 */
async function scrapeStearnsCountyRoadWork(): Promise<ScrapedRoadWork> {
  const items: RoadWorkItem[] = []

  try {
    console.log('Scraping Stearns County road work...')

    const response = await fetch('https://www.stearnscountymn.gov/560/Road-Construction', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    console.log('Stearns County page fetched, length:', html.length)

    return { items, source: 'Stearns County' }

  } catch (error) {
    console.error('Failed to scrape Stearns County road work:', error)
    return { items, source: 'Stearns County' }
  }
}

/**
 * Use ChatGPT-4 with better prompting to extract road work from web pages
 * This mimics the Make approach more closely
 */
export async function getRoadWorkWithChatGPT(targetDate: string): Promise<RoadWorkItem[]> {
  const { callOpenAI } = await import('./openai')

  console.log('🔍 Using ChatGPT-4 for road work extraction...')

  // First, fetch the key pages
  const sources = [
    'https://www.ci.stcloud.mn.us/307/Road-Construction-Projects',
    'https://www.stearnscountymn.gov/560/Road-Construction',
    'https://www.dot.state.mn.us/d3/',
  ]

  const pageContents: { url: string; content: string }[] = []

  for (const url of sources) {
    try {
      console.log(`Fetching: ${url}`)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (response.ok) {
        const html = await response.text()
        // Extract text content only (simplified - real implementation would parse HTML properly)
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 8000) // Limit to avoid token limits

        pageContents.push({ url, content: textContent })
        console.log(`✓ Fetched ${url} (${textContent.length} chars)`)
      }
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error)
    }
  }

  if (pageContents.length === 0) {
    console.error('No pages could be fetched')
    return []
  }

  // Now ask ChatGPT to extract road work from the pages
  const prompt = `You are analyzing real road construction web pages from St. Cloud, MN area government websites.

Today's date: ${targetDate}

I have fetched the following pages:
${pageContents.map(p => `\n--- ${p.url} ---\n${p.content.substring(0, 3000)}`).join('\n\n')}

Extract ALL active road work projects that are currently ongoing on ${targetDate}. Return ONLY a JSON array with this exact format:

[
  {
    "road_name": "Highway 15",
    "road_range": "from 2nd St to County Rd 75",
    "city_or_township": "St. Cloud",
    "reason": "Bridge maintenance",
    "start_date": "Sep 15",
    "expected_reopen": "Oct 10",
    "source_url": "https://www.dot.state.mn.us/d3/"
  }
]

CRITICAL:
- Extract real, specific projects from the page content above
- Only include projects active on ${targetDate}
- Use the actual source URL where you found each project
- Extract 6-9 projects if available
- Use short date format (mmm d)
- Return ONLY the JSON array, no markdown or explanations`

  try {
    const response = await callOpenAI(prompt, 3000, 0.2)

    console.log('ChatGPT response type:', typeof response)

    let roadWorkItems: RoadWorkItem[] = []

    if (Array.isArray(response)) {
      roadWorkItems = response
    } else if (typeof response === 'string') {
      // Parse JSON from string
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        roadWorkItems = JSON.parse(jsonMatch[0])
      }
    } else if (response && typeof response === 'object' && 'raw' in response) {
      const jsonMatch = (response as any).raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        roadWorkItems = JSON.parse(jsonMatch[0])
      }
    }

    console.log(`✓ Extracted ${roadWorkItems.length} road work items via ChatGPT`)
    return roadWorkItems

  } catch (error) {
    console.error('ChatGPT extraction failed:', error)
    return []
  }
}