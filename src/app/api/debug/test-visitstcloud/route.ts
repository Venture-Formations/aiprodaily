import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing VisitStCloud API access...')

    // Test a simple API call to VisitStCloud
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const apiUrl = `https://www.visitstcloud.com/wp-json/tribe/events/v1/events?start_date=${todayStr}&end_date=${todayStr}&per_page=5&status=publish`

    console.log('Testing API URL:', apiUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StCloudScoop/1.0'
      }
    })

    clearTimeout(timeoutId)

    console.log('API Response Status:', response.status)
    console.log('API Response Headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API returned ${response.status}`,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'VisitStCloud API is accessible',
      api_url: apiUrl,
      response_status: response.status,
      events_returned: Array.isArray(data) ? data.length : 'not array',
      sample_data: Array.isArray(data) ? data.slice(0, 2) : data,
      response_headers: Object.fromEntries(response.headers.entries())
    })

  } catch (error) {
    console.error('VisitStCloud API test failed:', error)

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        error: 'Request timed out after 10 seconds',
        message: 'VisitStCloud API may be slow or unresponsive'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to test VisitStCloud API',
      message: error instanceof Error ? error.message : 'Unknown error',
      error_name: error instanceof Error ? error.name : 'Unknown'
    })
  }
}