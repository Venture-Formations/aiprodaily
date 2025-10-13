/**
 * Perplexity AI Integration
 * Uses Perplexity's sonar-pro model with web search capabilities
 * This is what Make uses and gives much better real-time results
 */

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface PerplexityResponse {
  id: string
  model: string
  created: number
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Call Perplexity AI with web search enabled
 * This replicates the Make.com Perplexity module
 */
export async function callPerplexity(
  prompt: string,
  options: {
    model?: string
    temperature?: number
    searchContextSize?: 'low' | 'medium' | 'high'
  } = {}
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured')
  }

  const {
    model = 'sonar-pro',
    temperature = 0.2,
    searchContextSize = 'medium'
  } = options

  console.log('🔍 Calling Perplexity AI with web search...')
  console.log('Model:', model)
  console.log('Search context:', searchContextSize)

  const messages: PerplexityMessage[] = [
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        search_context_size: searchContextSize,
        return_images: false,
        return_related_questions: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Perplexity API error:', response.status, errorText)
      throw new Error(`Perplexity API error: ${response.status}`)
    }

    const data: PerplexityResponse = await response.json()

    console.log('✅ Perplexity response received')
    console.log('Tokens used:', data.usage.total_tokens)

    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in Perplexity response')
    }

    return content

  } catch (error) {
    console.error('Perplexity API call failed:', error)
    throw error
  }
}

/**
 * Get road work data using Perplexity (Make-style approach)
 */
export async function getRoadWorkWithPerplexity(targetDate: string): Promise<any[]> {
  console.log('🔍 Using Perplexity AI for road work (Make-style)...')

  // Format the date for display
  const dateObj = new Date(targetDate)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Request more results than needed so post-processing can filter to 9 valid local items
  const prompt = `Search for CURRENT road closures, construction, and traffic restrictions in St. Cloud, Minnesota and surrounding cities (Waite Park, Sartell, Sauk Rapids, St. Joseph, St. Augusta, Clearwater, Rice) that are CURRENTLY ACTIVE on ${formattedDate}.

CRITICAL: Only include items that are ACTIVE on ${formattedDate}. DO NOT include:
- Past events or parades that already happened
- Completed projects
- Future projects that haven't started yet
- Events from previous months

Check these sources:
- https://www.dot.state.mn.us/d3/
- https://www.stearnscountymn.gov/185/Public-Works
- https://www.ci.stcloud.mn.us
- https://www.sartellmn.com/engineering/
- https://www.ci.waitepark.mn.us/
- https://ci.sauk-rapids.mn.us/
- https://www.co.benton.mn.us/180/Highway
- Local news: WJON Traffic, St. Cloud Times

Find as many CURRENTLY ACTIVE road work items as possible in the St. Cloud area (within 15 miles of ZIP 56303). Return 15-20 items if available.

Include:
- Full road closures
- Lane closures
- Bridge work
- Detours
- Construction on highways, county roads, and city streets
- Both major and minor projects

EXCLUDE:
- Completed events or parades from previous months
- Seasonal events that are not currently active
- Projects that have already finished

Return ONLY a JSON array with this exact structure:
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

Requirements:
- Return 15-20 items (will be filtered to 9 locally)
- Only closures/construction active on ${formattedDate}
- Use date format "mmm d" (e.g., "Sep 15")
- Include both St. Cloud city and surrounding suburbs
- Return ONLY the JSON array, no markdown or extra text`

  // Old JSON structure prompt (keeping for reference)
  /*
  const oldPrompt = `{
  "query": {
  "query": {
    "description": "List every active road, lane, or bridge closure, detour, or major traffic restriction in effect on ${formattedDate} within 15 miles of ZIP code 56303 (St. Cloud, MN).",
    "criteria": {
      "date": "${targetDate}",
      "location_radius": {
        "zip_code": "56303",
        "radius_miles": 15
      },
      "inclusion_rules": {
        "include_types": {
          "examples": [
            "full closures",
            "lane closures",
            "bridge closures",
            "detours",
            "major traffic restrictions"
          ]
        },
        "include_conditions": {
          "examples": [
            "current closures",
            "recurring or periodic closures active on ${formattedDate}",
            "closures that started any time before or on ${formattedDate} and are still active",
            "closures from all road types (state, county, city streets)",
            "segment-specific impacts within larger projects",
            "direction-specific lane closures (e.g., westbound/eastbound)"
          ]
        },
        "include_synonyms": {
          "examples": [
            "construction impacts",
            "travel advisories",
            "traffic alerts",
            "detour notices"
          ]
        },
        "explicitly_include": [
          "Hwy 55",
          "Hwy 15",
          "closures near city boundaries or small towns like Kimball or Annandale"
        ],
        "exclusion_rules": {
          "examples": [
            "completed closures",
            "planned or future closures",
            "shoulder-only work"
          ]
        },
        "deduplicate_only": "truly overlapping or redundant entries"
      },
      "required_fields": [
        "road_segment",
        "city_or_township",
        "reason",
        "start_date",
        "expected_reopen",
        "source_url"
      ],
      "custom_parsing": {
        "split_road_segment": "If road_segment contains phrasing like '[road name] from [start point] to [end point]', extract '[road name]' as 'road_name' and 'from [start] to [end]' as 'road_range'."
      },
      "minimum_results": 9,
      "maximum_results": 9,
      "pagination_allowed": true
    },
    "sources": {
      "examples": [
        "https://www.dot.state.mn.us/d3/",
        "https://www.stearnscountymn.gov/185/Public-Works",
        "https://www.co.benton.mn.us/180/Highway",
        "https://www.co.sherburne.mn.us/162/Public-Works",
        "https://www.sartellmn.com/engineering/",
        "https://www.ci.stcloud.mn.us",
        "https://www.cityofstjoseph.com/",
        "https://www.ci.waitepark.mn.us/",
        "https://ci.sauk-rapids.mn.us/",
        "https://www.stcloudapo.org",
        "https://www.ridemetrobus.com",
        "Official Facebook pages (road/closure updates from last 30 days)",
        "Local media such as WJON Traffic, St. Cloud Times Roads section"
      ],
      "allow_additional_sources": true
    },
    "output_rules": {
      "format": "JSON_array_only",
      "json_starts_with": "[",
      "date_format": "ISO-8601",
      "deduplicate": true,
      "structure": [
        {
          "road_name": "string",
          "road_range": "string",
          "city_or_township": "string",
          "reason": "string",
          "start_date": "mmm d",
          "expected_reopen": "mmm d or 'TBD'",
          "source_url": "https://..."
        }
      ]
    }
  }
  }`
  */

  try {
    const response = await callPerplexity(prompt, {
      model: 'sonar-pro',
      temperature: 0.2,
      searchContextSize: 'medium'
    })

    console.log('Raw Perplexity response length:', response.length)
    console.log('Response preview:', response.substring(0, 200))

    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON array found in Perplexity response')
      console.error('Full response:', response)
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    console.log(`✅ Parsed ${parsed.length} road work items from Perplexity`)

    // Post-processing: Filter out items with dates that ended before target date
    const targetDateObj = new Date(targetDate)
    const filtered = parsed.filter((item: any) => {
      // Skip items without expected_reopen date
      if (!item.expected_reopen || item.expected_reopen === 'TBD' || item.expected_reopen === 'Not specified') {
        return true // Keep items without clear end dates
      }

      try {
        // Parse expected_reopen date (format: "mmm d" like "Oct 15")
        const reopenStr = item.expected_reopen
        const currentYear = targetDateObj.getFullYear()

        // Try to parse date
        let reopenDate: Date

        // Format: "mmm d" (e.g., "Oct 15")
        const monthDayMatch = reopenStr.match(/^([A-Za-z]+)\s+(\d+)$/)
        if (monthDayMatch) {
          reopenDate = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${currentYear}`)
        } else {
          // Can't parse, keep the item
          return true
        }

        // Filter out if reopen date is before target date
        if (reopenDate < targetDateObj) {
          console.log(`⚠️ Filtering out ${item.road_name} - ended ${item.expected_reopen} (before ${targetDate})`)
          return false
        }

        return true
      } catch (error) {
        // If we can't parse the date, keep the item
        console.log(`⚠️ Could not parse date for ${item.road_name}: ${item.expected_reopen}`)
        return true
      }
    })

    console.log(`✅ After date filtering: ${filtered.length} items (removed ${parsed.length - filtered.length} outdated items)`)

    return filtered

  } catch (error) {
    console.error('Perplexity road work extraction failed:', error)
    return []
  }
}