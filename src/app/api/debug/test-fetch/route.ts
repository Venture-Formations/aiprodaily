import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
    }

    console.log('=== FETCH DEBUG TEST ===')
    console.log('Testing URL:', imageUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      console.log('Attempting fetch with StCloudScoop user agent...')
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'StCloudScoop-Newsletter/1.0'
        }
      })

      clearTimeout(timeoutId)

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      const contentType = response.headers.get('content-type')

      if (!response.ok) {
        return NextResponse.json({
          debug: 'Fetch Test',
          url: imageUrl,
          success: false,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error: `HTTP ${response.status} ${response.statusText}`
        })
      }

      // Get content length without downloading full image
      const contentLength = response.headers.get('content-length')

      return NextResponse.json({
        debug: 'Fetch Test',
        url: imageUrl,
        success: true,
        status: response.status,
        statusText: response.statusText,
        contentType,
        contentLength,
        headers: Object.fromEntries(response.headers.entries())
      })

    } catch (fetchError) {
      clearTimeout(timeoutId)

      return NextResponse.json({
        debug: 'Fetch Test',
        url: imageUrl,
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
        errorType: fetchError instanceof Error ? fetchError.name : 'UnknownError'
      })
    }

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to run fetch test'
    }, { status: 500 })
  }
}