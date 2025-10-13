import { NextRequest, NextResponse } from 'next/server'
import { callOpenAIWithWebSearch } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Only allow with test secret
  if (secret !== 'test-improved-road-work') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('=== TESTING IMPROVED AI ROAD WORK WITH WEB SEARCH ===')

    // Get the latest campaign to use its date
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      throw new Error('Could not find latest campaign')
    }

    const testDate = campaign.date
    console.log('Testing with campaign date:', testDate)
    console.log('Campaign ID:', campaign.id)

    // Convert to formatted date
    const formattedDate = new Date(testDate).toISOString().split('T')[0]

    // Use the simplified prompts
    const systemPrompt = `You are a local traffic researcher with web search capabilities. Search for active road closures and construction in the St. Cloud, Minnesota area.

Target Date: ${formattedDate}
Location: Within 15 miles of St. Cloud, MN (ZIP 56303)

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

    const userPrompt = `Search for ALL active road closures, construction, and traffic restrictions in St. Cloud, MN area that are happening on ${formattedDate}.

Return a JSON array with 6-9 items. Each item must use this exact format:

{
  "road_name": "Highway 15",
  "road_range": "from 2nd St to County Rd 75",
  "city_or_township": "St. Cloud",
  "reason": "Bridge maintenance",
  "start_date": "Sep 15",
  "expected_reopen": "Oct 10",
  "source_url": "https://www.dot.state.mn.us/d3/"
}

Requirements:
- Search ALL the government sources provided
- Include highways, county roads, and city streets
- Only projects active on ${formattedDate}
- Find at least 6-9 real current projects
- Use short date format (mmm d) not ISO dates
- Return ONLY the JSON array, starting with [ and ending with ]
- No markdown formatting, no explanations`

    console.log('=== SYSTEM PROMPT ===')
    console.log(systemPrompt)
    console.log('=== USER PROMPT ===')
    console.log(userPrompt)
    console.log('=== CALLING WEB SEARCH API ===')

    // Call the improved web search function
    const aiResponse = await callOpenAIWithWebSearch(systemPrompt, userPrompt)

    console.log('=== FINAL RESPONSE ===')
    console.log('Type:', typeof aiResponse)
    console.log('Is Array:', Array.isArray(aiResponse))
    console.log('Length:', aiResponse?.length || 'N/A')
    console.log('Content:', JSON.stringify(aiResponse, null, 2).substring(0, 1000))

    return NextResponse.json({
      success: true,
      campaignDate: testDate,
      formattedDate,
      campaignId: campaign.id,
      response: {
        type: typeof aiResponse,
        isArray: Array.isArray(aiResponse),
        length: aiResponse?.length || 'N/A',
        data: aiResponse
      },
      prompts: {
        system: systemPrompt,
        user: userPrompt
      }
    })

  } catch (error) {
    console.error('Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}