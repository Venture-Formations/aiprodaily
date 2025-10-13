import { NextRequest, NextResponse } from 'next/server'
import { storeRoadWorkData } from '@/lib/road-work-manager'

// Generate fallback road work data for testing
function generateTestRoadWorkData(targetDate: string) {
  const startDateShort = targetDate.split(',')[0] || 'Sep 25'

  return [
    {
      road_name: 'Highway 15',
      road_range: 'from 2nd Street S to Benton Drive',
      city_or_township: 'St. Cloud',
      reason: 'Bridge maintenance and repairs',
      start_date: startDateShort,
      expected_reopen: 'Oct 15',
      source_url: 'https://www.dot.state.mn.us/d3/'
    },
    {
      road_name: 'County Road 75',
      road_range: 'from 33rd Street to Park Avenue',
      city_or_township: 'Waite Park',
      reason: 'Road resurfacing project',
      start_date: startDateShort,
      expected_reopen: 'Nov 1',
      source_url: 'https://www.stearnscountymn.gov/185/Public-Works'
    },
    {
      road_name: 'Highway 23',
      road_range: 'from 14th Avenue to 22nd Avenue',
      city_or_township: 'St. Cloud',
      reason: 'Utility work and lane restrictions',
      start_date: startDateShort,
      expected_reopen: 'Oct 30',
      source_url: 'https://www.dot.state.mn.us/d3/'
    },
    {
      road_name: '1st Street South',
      road_range: 'from 7th Avenue to 10th Avenue',
      city_or_township: 'Sartell',
      reason: 'Paving project',
      start_date: startDateShort,
      expected_reopen: 'Oct 5',
      source_url: 'https://www.cityofsartell.com'
    },
    {
      road_name: 'County Road 4',
      road_range: 'from Highway 24 to County Road 2',
      city_or_township: 'Clearwater',
      reason: 'Drainage improvements',
      start_date: startDateShort,
      expected_reopen: 'Oct 12',
      source_url: 'https://www.co.sherburne.mn.us/162/Public-Works'
    },
    {
      road_name: 'Highway 10',
      road_range: 'from Highway 15 to County Road 3',
      city_or_township: 'Sauk Rapids',
      reason: 'Interchange construction',
      start_date: startDateShort,
      expected_reopen: 'Dec 1',
      source_url: 'https://www.dot.state.mn.us/d3/'
    },
    {
      road_name: 'Highway 24',
      road_range: 'from Clearwater Bridge to 200th Street',
      city_or_township: 'Clear Lake',
      reason: 'Bridge maintenance',
      start_date: startDateShort,
      expected_reopen: 'Oct 20',
      source_url: 'https://www.dot.state.mn.us/d3/'
    },
    {
      road_name: 'County Road 8',
      road_range: 'from 9th Avenue to County Road 43',
      city_or_township: 'St. Joseph',
      reason: 'Resurfacing project',
      start_date: startDateShort,
      expected_reopen: 'Oct 8',
      source_url: 'https://www.co.benton.mn.us/180/Highway'
    },
    {
      road_name: 'Highway 55',
      road_range: 'from Kimball to Annandale',
      city_or_township: 'Kimball',
      reason: 'Road widening project',
      start_date: startDateShort,
      expected_reopen: 'Oct 25',
      source_url: 'https://www.dot.state.mn.us/d3/'
    }
  ]
}

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Road Work fallback data and database storage...')

    const { searchParams } = new URL(request.url)
    const campaignDate = searchParams.get('campaign_date') || 'Sep 25, 2024'

    console.log(`Generating fallback road work for date: ${campaignDate}`)

    // Generate test road work data
    const roadWorkItems = generateTestRoadWorkData(campaignDate)

    // Generate simple HTML for the test
    const htmlContent = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Road Work</h2>
    </td>
  </tr>
  ${roadWorkItems.map((item, index) => `
  <tr>
    <td style="padding: 8px;">
      <strong>${item.road_name}</strong> (${item.city_or_township})<br>
      ${item.reason}<br>
      <small>${item.start_date} - ${item.expected_reopen}</small>
    </td>
  </tr>
  `).join('')}
</table>
<br>`

    // Create road work data structure
    const roadWorkData = {
      campaign_id: '', // Will be set when associated with a campaign
      generated_at: new Date().toISOString(),
      road_work_data: roadWorkItems,
      html_content: htmlContent,
      is_active: true
    }

    console.log('Attempting to store road work data in database...')

    // Try to store in database
    const storedData = await storeRoadWorkData(roadWorkData)

    console.log('✅ Road work data stored successfully:', storedData.id)

    return NextResponse.json({
      success: true,
      message: 'Road work fallback data generated and stored successfully',
      generated_at: new Date().toISOString(),
      total_items: roadWorkItems.length,
      stored_id: storedData.id,
      roadWorkItems: roadWorkItems,
      sample_html: htmlContent.substring(0, 500) + '...'
    })

  } catch (error) {
    console.error('Road work fallback test failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to test road work fallback data'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}