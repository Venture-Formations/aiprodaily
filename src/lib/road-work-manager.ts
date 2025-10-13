// Road Work database operations and management

import { supabaseAdmin } from './supabase'
import { AI_PROMPTS, callOpenAI } from './openai'
import type { RoadWorkData, RoadWorkItem } from '@/types/database'
import { wrapTrackingUrl } from './url-tracking'

// Create a function to search for real road work data
async function searchRealRoadWorkData(targetDate: string): Promise<string> {
  console.log('🔍 Searching for real road work data using WebSearch...')

  const searchQueries = [
    `St Cloud Minnesota road closures construction ${targetDate}`,
    `Stearns County MN road work highway closures ${targetDate}`,
    `MnDOT District 3 road construction detours ${targetDate}`,
    `Waite Park Sartell road closures traffic alerts ${targetDate}`
  ]

  let realSearchResults = ''

  // Import WebSearch dynamically to avoid module resolution issues
  try {
    // Since we have access to WebSearch tool, let's try to use it properly
    // Note: This approach simulates what we would do with a proper web search implementation
    console.log('Attempting to gather real road work data...')

    // For now, I'll modify the approach to be more explicit about real data requirements
    // The core issue is that we need actual web search functionality

    realSearchResults = `Real data search attempted for: ${searchQueries.join(', ')}\n`
    realSearchResults += `Date: ${targetDate}\n`
    realSearchResults += `Note: Web search capability needed for real-time road work data\n`

    console.log('Search attempt completed, real data would go here')

  } catch (error) {
    console.warn('Web search failed:', error)
  }

  return realSearchResults
}

// Type for HTML generation (minimal road work item data)
type RoadWorkItemForHTML = {
  road_name: string
  road_range: string | null
  city_or_township: string | null
  reason: string | null
  start_date: string | null
  expected_reopen: string | null
  source_url: string | null
}

/**
 * Generate HTML content for Road Work section
 */
export function generateRoadWorkHTML(roadWorkItems: RoadWorkItemForHTML[], campaignDate?: string, campaignId?: string): string {
  // Handle empty or no road work data
  if (!roadWorkItems || roadWorkItems.length === 0) {
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 15px; text-align: center;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0 0 10px 0;">Road Work</h2>
      <p style="margin: 0; font-size: 16px; color: #666;">No major road closures or construction impacts reported for the St. Cloud area today.</p>
    </td>
  </tr>
</table>
<br>`
  }

  // Create responsive grid layout that adapts to the number of items
  const rows = []

  for (let i = 0; i < roadWorkItems.length; i += 3) {
    const rowItems = roadWorkItems.slice(i, i + 3)

    const rowHTML = `<tr class='row'>${rowItems.map(item => {
      // Wrap source URL with tracking if campaignDate is provided
      const sourceUrl = item.source_url && item.source_url !== '#' && campaignDate
        ? wrapTrackingUrl(item.source_url, 'Road Work', campaignDate, campaignId)
        : (item.source_url || '#')

      return `
      <td class='column' style='padding:8px; vertical-align: top;'>
        <table width='100%' cellpadding='0' cellspacing='0' style='font-size: 16px; line-height: 24px; border: 1px solid #ddd; border-radius: 12px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15); overflow: hidden; font-family: Arial, sans-serif;'>
          <tr>
            <td style='background-color: #F8F9FA; text-align: center; padding: 8px; font-size: 16px; line-height: 26px; color: #3C4043; font-weight: bold;'>
              ${item.road_name}
            </td>
          </tr>
          <tr>
            <td style='padding: 16px; font-size: 16px; line-height: 26px; text-align: center;'>
              <div style='text-align: center;'>${item.road_range || 'N/A'}</div>
              <div style='font-size: 15px; line-height: 20px; text-align: center;'>
                ${item.reason || 'Road work'} (<a href='${sourceUrl}' style='color:#000; text-decoration: underline;'>link</a>)
              </div>
              <div style='margin-top: 8px; font-size: 14px; text-align: center;'>
                ${item.start_date || 'TBD'} → ${item.expected_reopen || 'TBD'}   📍 ${item.city_or_township || 'Area'}
              </div>
            </td>
          </tr>
        </table>
      </td>`
    }).join('')}</tr>`

    rows.push(rowHTML)
  }

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Road Work</h2>
    </td>
  </tr>
  ${rows.join('')}
</table>
<br>`
}

/**
 * REMOVED: generateFallbackRoadWorkData
 * We never want inaccurate filler data in the newsletter.
 * If AI methods fail, the system will return fewer items or no road work section.
 */

/**
 * Store road work items in the normalized database structure
 */
// Helper function to parse date strings from AI responses
function parseRoadWorkDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr === 'TBD') return null

  try {
    // Handle common AI response formats
    const currentYear = new Date().getFullYear()

    // Format: "Apr 15", "Jun 2", "Oct 30"
    if (/^[A-Za-z]{3}\s+\d{1,2}$/.test(dateStr)) {
      const parsedDate = new Date(`${dateStr}, ${currentYear}`)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0] // Return YYYY-MM-DD format
      }
    }

    // Format: "mid-Oct", "early Nov", "late Dec" - convert to middle of month
    const monthMatch = dateStr.match(/(early|mid|late)\s*-?\s*([A-Za-z]{3})/i)
    if (monthMatch) {
      const [, timing, month] = monthMatch
      const monthDay = timing.toLowerCase() === 'early' ? 5 : timing.toLowerCase() === 'late' ? 25 : 15
      const parsedDate = new Date(`${month} ${monthDay}, ${currentYear}`)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0]
      }
    }

    // Format: "2025-10-15" (already properly formatted)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }

    // Try parsing as-is
    const parsedDate = new Date(dateStr)
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0]
    }

  } catch (error) {
    console.warn(`Failed to parse date "${dateStr}":`, error)
  }

  // If all parsing fails, return null
  console.warn(`Could not parse road work date: "${dateStr}", storing as null`)
  return null
}

export async function storeRoadWorkItems(roadWorkItems: Array<{
  road_name: string
  road_range: string | null
  city_or_township: string | null
  reason: string | null
  start_date: string | null
  expected_reopen: string | null
  source_url: string | null
}>, campaignId: string): Promise<RoadWorkItem[]> {
  console.log(`Storing ${roadWorkItems.length} road work items in normalized database...`)

  // Prepare items for insertion with display order and date parsing
  const itemsToInsert = roadWorkItems.map((item, index) => ({
    campaign_id: campaignId,
    road_name: item.road_name,
    road_range: item.road_range,
    city_or_township: item.city_or_township,
    reason: item.reason,
    start_date: parseRoadWorkDate(item.start_date),
    expected_reopen: parseRoadWorkDate(item.expected_reopen),
    source_url: item.source_url,
    display_order: index + 1,
    is_active: true
  }))

  const { data, error } = await supabaseAdmin
    .from('road_work_items')
    .insert(itemsToInsert)
    .select()

  if (error) {
    console.error('Failed to store road work items:', error)
    throw new Error(`Failed to store road work items: ${error.message}`)
  }

  console.log('✅ Road work items stored successfully:', data?.length || 0, 'items')

  // Auto-select 9 most complete and relevant items for the campaign
  if (data && data.length > 0) {
    // Score items based on completeness and relevance
    const scoredItems = data.map(item => {
      let score = 0

      // Prioritize items with complete information (each field = +1 point)
      if (item.road_name) score += 1
      if (item.road_range && item.road_range !== 'N/A' && item.road_range !== 'unspecified segment') score += 1
      if (item.city_or_township && item.city_or_township !== 'Area') score += 1
      if (item.reason && item.reason !== 'Road work') score += 1
      if (item.start_date && item.start_date !== 'TBD') score += 1
      if (item.expected_reopen && item.expected_reopen !== 'TBD') score += 1
      if (item.source_url && item.source_url !== '#') score += 1

      // Prioritize ongoing construction over events (events often have misleading dates)
      const reason = (item.reason || '').toLowerCase()
      if (reason.includes('event') || reason.includes('parade') || reason.includes('festival')) {
        score -= 3 // Deprioritize events
      }
      if (reason.includes('construction') || reason.includes('reconstruction') || reason.includes('resurfacing')) {
        score += 2 // Prioritize construction
      }

      return { item, score }
    })

    // Sort by score (highest first) and take top 9
    const topItems = scoredItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map(({ item }) => item)

    const selectionData = topItems.map((item, index) => ({
      campaign_id: campaignId,
      road_work_item_id: item.id,
      selection_order: index + 1
    }))

    const { error: selectionError } = await supabaseAdmin
      .from('campaign_road_work_selections')
      .insert(selectionData)

    if (selectionError) {
      console.warn('⚠️ Failed to auto-select road work items (table may not exist yet):', selectionError.message)
    } else {
      console.log(`✅ Auto-selected ${topItems.length} most complete/relevant road work items for campaign`)
    }
  }

  return data || []
}

/**
 * Get road work items for a campaign
 */
export async function getRoadWorkItemsForCampaign(campaignId: string): Promise<RoadWorkItem[]> {
  const { data, error } = await supabaseAdmin
    .from('road_work_items')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Failed to get road work items:', error)
    return []
  }

  return data || []
}

/**
 * Get SELECTED road work items for a campaign (only items selected for email)
 */
export async function getSelectedRoadWorkItemsForCampaign(campaignId: string): Promise<RoadWorkItem[]> {
  const { data, error } = await supabaseAdmin
    .from('campaign_road_work_selections')
    .select(`
      selection_order,
      road_work_item:road_work_items(*)
    `)
    .eq('campaign_id', campaignId)
    .order('selection_order', { ascending: true })

  if (error) {
    // If table doesn't exist yet, fall back to all items
    if (error.message && error.message.includes('relation "campaign_road_work_selections" does not exist')) {
      console.log('⚠️ Selection table not created yet, falling back to all road work items')
      return getRoadWorkItemsForCampaign(campaignId)
    }
    console.error('Failed to get selected road work items:', error)
    return []
  }

  // Extract road_work_item from the joined data
  const items = data?.map((selection: any) => selection.road_work_item).filter(Boolean) || []

  // If no selections exist, fall back to first 9 items
  if (items.length === 0) {
    console.log('⚠️ No selections found, falling back to first 9 road work items')
    const allItems = await getRoadWorkItemsForCampaign(campaignId)
    return allItems.slice(0, 9)
  }

  return items
}

/**
 * Store road work data in the database (LEGACY - for backward compatibility)
 */
export async function storeRoadWorkData(roadWorkData: Omit<RoadWorkData, 'id' | 'created_at' | 'updated_at'>, campaignId?: string): Promise<RoadWorkData> {
  console.log('Storing road work data in database...')

  const dataToInsert = {
    ...roadWorkData,
    campaign_id: campaignId || null
  }

  const { data, error } = await supabaseAdmin
    .from('road_work_data')
    .insert(dataToInsert)
    .select()
    .single()

  if (error) {
    console.error('Failed to store road work data:', error)
    throw new Error(`Failed to store road work data: ${error.message}`)
  }

  console.log('✅ Road work data stored successfully:', data.id)
  return data
}

/**
 * Generate daily road work data using AI and store in database
 * Called by cron job or manual generation
 */
export async function generateDailyRoadWork(campaignDate?: string): Promise<RoadWorkData> {
  console.log('Starting daily road work generation...')

  try {
    // Use provided date or tomorrow in Central Time
    let targetDate: string
    if (campaignDate) {
      targetDate = campaignDate
    } else {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000))
      targetDate = tomorrow.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Chicago'
      })
    }

    console.log('Generating road work data for date:', targetDate)

    // Search for real road work data using web search
    console.log('🔍 Searching for real road work data from government sources...')

    const searchQueries = [
      `St Cloud Minnesota road closures construction ${targetDate}`,
      `Stearns County MN road work highway closures ${targetDate}`,
      `MnDOT District 3 road construction detours ${targetDate}`,
      `Waite Park Sartell road closures traffic alerts ${targetDate}`,
      `Highway 10 Highway 15 Minnesota construction ${targetDate}`
    ]

    let searchResults = ''

    // Use Perplexity for real web search and data extraction
    console.log('🔍 Using Perplexity to search for real road work data...')
    const { callPerplexity } = await import('./perplexity')

    // Convert target date to the format expected by the prompts
    const formattedDate = new Date(targetDate).toISOString().split('T')[0] // Convert to YYYY-MM-DD

    const searchPrompt = `Find road, lane, or bridge closures, detours, or traffic restrictions within 15 miles of St. Cloud, Minnesota (ZIP 56303) that are:
1. Currently active on ${formattedDate}, OR
2. Planned to start within the next 7 days (between ${formattedDate} and 7 days later)

CRITICAL: Search these OFFICIAL government sources for REAL road work data:
- https://www.dot.state.mn.us/d3/ (MnDOT District 3)
- https://www.stearnscountymn.gov/185/Public-Works
- https://www.ci.stcloud.mn.us/307/Road-Construction-Projects
- https://www.cityofsartell.com/engineering/
- https://www.ci.waitepark.mn.us/
- https://ci.sauk-rapids.mn.us/
- Local news: WJON Traffic, St. Cloud Times

ONLY include road work that:
- Is currently active on ${formattedDate} OR starts within next 7 days
- Has CONFIRMED specific dates (not "TBD" or vague ranges)
- Is from an official government or news source

Return ONLY a JSON array with 6-9 real entries:
[
  {
    "road_name": "[exact road name from source]",
    "road_range": "[exact range from source, e.g., '2nd St NE to 7th St NE']",
    "city_or_township": "[exact city from source]",
    "reason": "[exact reason from source]",
    "start_date": "[exact date like 'Oct 6' or 'May 1']",
    "expected_reopen": "[exact date like 'Oct 20' or 'Nov 30']",
    "source_url": "[actual URL where this info was found]"
  }
]

CRITICAL: Return ONLY real, verified road work from actual sources. Better to return 3-4 confirmed items than 9 made-up items.

Search these official sources:
- MnDOT District 3: https://www.dot.state.mn.us/d3/
- Stearns County Public Works: https://www.stearnscountymn.gov/185/Public-Works
- Benton County Highway: https://www.co.benton.mn.us/180/Highway
- Sherburne County: https://www.co.sherburne.mn.us/162/Public-Works
- City of St. Cloud: https://www.ci.stcloud.mn.us
- City of Sartell: https://www.sartellmn.com/engineering/
- City of Sauk Rapids: https://ci.sauk-rapids.mn.us/
- City of Waite Park: https://www.ci.waitepark.mn.us/
- Metro Bus: https://www.ridemetrobus.com
- Local news: WJON, St. Cloud Times

Include: Road closures, lane closures, bridge work, detours, construction on highways, county roads, and city streets.

Respond with ONLY a JSON array. No explanations or markdown.`

    const userPrompt = `Today's date is ${formattedDate}. Search for ALL active road closures, construction, and traffic restrictions in St. Cloud, MN area that are CURRENTLY ACTIVE on this date.

Return a JSON array with 6-9 items. Each item must use this exact format:

{
  "road_name": "Highway 15",
  "road_range": "from 2nd St to County Rd 75",
  "city_or_township": "St. Cloud",
  "reason": "Bridge maintenance",
  "start_date": "Sep 15",
  "expected_reopen": "Oct 15",
  "source_url": "https://www.dot.state.mn.us/d3/"
}

CRITICAL REQUIREMENTS:
- Today is ${formattedDate}
- Only include projects CURRENTLY ACTIVE on ${formattedDate}
- DO NOT include projects that ended before ${formattedDate}
- DO NOT include any projects from previous years
- For expected_reopen dates, prefer specific day format: "Oct 15", "Nov 30", "Dec 5"
- If only month is known, use format "Oct 2025", "Nov 2025" (will be treated as 20th of month)
- Vague dates like "Late Aug", "Early Oct" are acceptable if specific dates unavailable
- Search ALL the government sources provided
- Include highways, county roads, and city streets
- Find at least 6-9 real current projects still active on ${formattedDate}
- Use short date format like "Oct 15" not ISO dates
- Return ONLY the JSON array, starting with [ and ending with ]
- No markdown formatting, no explanations`

    // Use Perplexity to search for real road work data
    console.log('🔍 Calling Perplexity for real road work data...')

    const perplexityResult = await callPerplexity(searchPrompt, {
      model: 'sonar-pro',
      temperature: 0.2,
      searchContextSize: 'high'
    })

    console.log('📊 Perplexity raw response:', perplexityResult)

    let aiResponse: any = null

    try {
      // Try to parse Perplexity's JSON response
      aiResponse = JSON.parse(perplexityResult)
      console.log('✅ Successfully parsed Perplexity JSON response:', aiResponse?.length || 0, 'items')
    } catch (parseError) {
      console.log('❌ Failed to parse Perplexity response as JSON, trying to extract from markdown...')

      // Try to extract JSON from markdown code blocks
      const jsonMatch = perplexityResult.match(/\[[\s\S]*\]/)?.[0]
      if (jsonMatch) {
        try {
          aiResponse = JSON.parse(jsonMatch)
          console.log('✅ Extracted JSON from markdown:', aiResponse?.length || 0, 'items')
        } catch (e) {
          console.error('❌ Could not extract valid JSON from Perplexity response')
          aiResponse = []
        }
      } else {
        console.error('❌ No JSON array found in Perplexity response')
        aiResponse = []
      }
    }

    // Parse AI response - simplified logic matching working debug endpoint
    let roadWorkItems: RoadWorkItem[] = []

    console.log('🔍 AI Response Type:', typeof aiResponse)
    console.log('🔍 AI Response Is Array:', Array.isArray(aiResponse))
    console.log('🔍 AI Response Length:', aiResponse?.length || 'N/A')

    // Direct array handling (debug endpoint shows this works)
    if (Array.isArray(aiResponse)) {
      console.log('✅ AI returned direct array, using as-is')
      roadWorkItems = aiResponse
    }
    // String handling
    else if (typeof aiResponse === 'string') {
      console.log('🔍 AI returned string, parsing JSON')
      try {
        // Clean and parse JSON string
        let cleanedJson = aiResponse.trim()
        cleanedJson = cleanedJson
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')

        roadWorkItems = JSON.parse(cleanedJson)
        console.log('✅ Successfully parsed string to array:', roadWorkItems.length, 'items')
      } catch (stringParseError) {
        console.error('❌ Failed to parse AI string response:', stringParseError)
        throw new Error(`Failed to parse AI string response: ${stringParseError instanceof Error ? stringParseError.message : 'Unknown error'}`)
      }
    }
    // Object with raw property handling
    else if (aiResponse && typeof aiResponse === 'object' && 'raw' in aiResponse) {
      console.log('🔍 AI returned object with raw property, parsing')
      try {
        const rawContent = (aiResponse as any).raw
        if (typeof rawContent === 'string') {
          roadWorkItems = JSON.parse(rawContent)
          console.log('✅ Successfully parsed raw content:', roadWorkItems.length, 'items')
        } else {
          throw new Error('Raw property is not a string')
        }
      } catch (rawParseError) {
        console.error('❌ Failed to parse raw content:', rawParseError)
        throw new Error(`Failed to parse raw content: ${rawParseError instanceof Error ? rawParseError.message : 'Unknown error'}`)
      }
    }
    // Unexpected format
    else {
      console.error('❌ Unexpected AI response format:', {
        type: typeof aiResponse,
        isArray: Array.isArray(aiResponse),
        hasRaw: aiResponse && typeof aiResponse === 'object' && 'raw' in aiResponse,
        content: JSON.stringify(aiResponse, null, 2)
      })
      throw new Error(`Unexpected AI response format: ${typeof aiResponse}`)
    }

    // Validate we have road work items
    if (!Array.isArray(roadWorkItems)) {
      throw new Error('AI response is not an array')
    }

    console.log(`Found ${roadWorkItems.length} total road work items from web search`)

    // Validate road work items for accuracy using AI
    console.log('🔍 Validating road work items for date accuracy and completeness...')

    try {
      const validationPrompt = await AI_PROMPTS.roadWorkValidator(roadWorkItems, formattedDate)
      const validationResponse = await callOpenAI(validationPrompt, 2000, 0)

      console.log('Validation response:', JSON.stringify(validationResponse, null, 2))

      if (validationResponse && validationResponse.validated_items) {
        // Filter to only valid items
        const validIndices = validationResponse.validated_items
          .filter((item: any) => item.valid === true && item.confidence >= 0.7)
          .map((item: any) => item.index)

        const beforeValidation = roadWorkItems.length
        roadWorkItems = roadWorkItems.filter((_, index) => validIndices.includes(index))

        console.log(`✅ AI Validation: ${roadWorkItems.length}/${beforeValidation} items passed (${validationResponse.summary?.accuracy_score || 'N/A'} accuracy score)`)

        // Log rejected items for debugging
        validationResponse.validated_items
          .filter((item: any) => !item.valid || item.confidence < 0.7)
          .forEach((item: any) => {
            console.log(`   ❌ Rejected item ${item.index}: ${item.reason} (confidence: ${item.confidence})`)
          })
      }
    } catch (validationError) {
      console.warn('⚠️ AI validation failed, proceeding with unvalidated items:', validationError)
    }

    // Helper function to parse dates
    const parseRoadWorkDate = (dateStr: string): Date | null => {
      if (!dateStr || dateStr === 'TBD') return null

      try {
        // Handle seasonal dates like "Fall 2027", "Spring 2025", "Summer 2026", "Winter 2025"
        const seasonMatch = dateStr.match(/^(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})$/i)
        if (seasonMatch) {
          const [, season, year] = seasonMatch
          const seasonLower = season.toLowerCase()

          // Map seasons to approximate end dates
          if (seasonLower === 'spring') {
            return new Date(`June 20, ${year}`) // End of spring
          } else if (seasonLower === 'summer') {
            return new Date(`September 22, ${year}`) // End of summer
          } else if (seasonLower === 'fall' || seasonLower === 'autumn') {
            return new Date(`December 20, ${year}`) // End of fall
          } else if (seasonLower === 'winter') {
            return new Date(`March 20, ${year}`) // End of winter
          }
        }

        // Handle vague dates like "Late Aug", "Early Sep", "Mid Oct"
        const vagueMatch = dateStr.match(/^(Early|Mid|Late)\s+([A-Za-z]+)(?:\s+(\d{4}))?$/i)
        if (vagueMatch) {
          const [, timing, month, year] = vagueMatch
          const currentYear = new Date().getFullYear()
          const yearToUse = year ? parseInt(year) : currentYear

          const dateString = `${month} 1, ${yearToUse}`
          const date = new Date(dateString)

          if (timing.toLowerCase() === 'late') {
            // Last day of month
            date.setMonth(date.getMonth() + 1)
            date.setDate(0)
          } else if (timing.toLowerCase() === 'mid') {
            // 15th of month
            date.setDate(15)
          } else if (timing.toLowerCase() === 'early') {
            // 5th of month
            date.setDate(5)
          }

          return date
        }

        // Handle "mmm yyyy" format (e.g., "Oct 2024", "Nov 2024") - use 20th of month
        const yearOnlyMatch = dateStr.match(/^([A-Za-z]+)\s+(\d{4})$/)
        if (yearOnlyMatch) {
          const [, month, year] = yearOnlyMatch
          const dateString = `${month} 20, ${year}`
          return new Date(dateString)
        }

        // Handle "mmm d" or "mmm d, yyyy" format (e.g., "Oct 15" or "Oct 15, 2025")
        const dayMatch = dateStr.match(/^([A-Za-z]+)\s+(\d+)(?:,?\s*(\d{4}))?$/)
        if (dayMatch) {
          const [, month, day, year] = dayMatch
          const currentYear = new Date().getFullYear()
          const yearToUse = year ? parseInt(year) : currentYear
          const dateString = `${month} ${day}, ${yearToUse}`
          return new Date(dateString)
        }

        // Handle year-only format (e.g., "2024", "2027")
        const onlyYearMatch = dateStr.match(/^(\d{4})$/)
        if (onlyYearMatch) {
          return new Date(`December 31, ${onlyYearMatch[1]}`)
        }

        // Try direct parsing as fallback
        const fallbackDate = new Date(dateStr)
        if (!isNaN(fallbackDate.getTime())) {
          return fallbackDate
        }

        return null
      } catch (error) {
        console.warn(`Could not parse date: ${dateStr}`)
        return null
      }
    }

    // Get target date for comparison
    const targetDateObj = new Date(targetDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filter out placeholder entries and completed projects
    const beforeFilter = roadWorkItems.length
    roadWorkItems = roadWorkItems.filter(item => {
      // Filter placeholders
      if (item.road_name === 'No Additional Closures' ||
          item.road_name === 'No Additional Major Closures' ||
          item.reason === 'No additional major closures reported' ||
          item.reason === 'No major closures reported') {
        console.log(`Filtering out placeholder: ${item.road_name}`)
        return false
      }

      // Check if project has already ended
      if (item.expected_reopen) {
        const reopenDate = parseRoadWorkDate(item.expected_reopen)
        if (reopenDate && reopenDate < today) {
          console.log(`Filtering out completed project: ${item.road_name} (ended ${item.expected_reopen})`)
          return false
        }
      }

      return true
    })

    console.log(`Filtered ${beforeFilter - roadWorkItems.length} outdated/placeholder items`)

    // If we have more than 9 real items, take the first 9 (most significant ones should be first)
    if (roadWorkItems.length > 9) {
      console.log(`Selecting top 9 real items from ${roadWorkItems.length} found items`)
      roadWorkItems = roadWorkItems.slice(0, 9)
    }

    // Use real items only - no padding with placeholders
    console.log(`Using ${roadWorkItems.length} real road work items (no filler content)`)

    console.log(`Successfully parsed ${roadWorkItems.length} road work items`)

    // Generate HTML content
    const htmlContent = generateRoadWorkHTML(roadWorkItems)
    console.log('Road work HTML generated')

    // Prepare road work data for database
    const roadWorkData: Omit<RoadWorkData, 'id' | 'created_at' | 'updated_at'> = {
      campaign_id: '', // Will be set when associated with a campaign
      generated_at: new Date().toISOString(),
      road_work_data: roadWorkItems,
      html_content: htmlContent,
      is_active: true
    }

    console.log('✅ Road work data generation completed successfully')

    // Store the generated data in the database
    const storedData = await storeRoadWorkData(roadWorkData)
    return storedData

  } catch (error) {
    console.error('❌ Road work generation failed:', error)
    throw error
  }
}

/**
 * Get the current road work data for a specific date
 */
export async function getRoadWorkForDate(date: string): Promise<RoadWorkData | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('road_work_data')
      .select('*')
      .eq('generated_at', date)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch road work data:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching road work data:', error)
    return null
  }
}

/**
 * Save road work data to database
 */
export async function saveRoadWorkData(roadWorkData: Omit<RoadWorkData, 'id' | 'created_at' | 'updated_at'>): Promise<RoadWorkData> {
  try {
    const { data, error } = await supabaseAdmin
      .from('road_work_data')
      .insert(roadWorkData)
      .select()
      .single()

    if (error) {
      console.error('Failed to save road work data:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error saving road work data:', error)
    throw error
  }
}