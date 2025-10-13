import { NextRequest, NextResponse } from 'next/server'
import { GoogleVisionService } from '@/lib/google-vision'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('imageUrl') || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'

    console.log('=== Detailed Google Vision Test ===')
    console.log('Testing image URL:', imageUrl)

    const visionService = new GoogleVisionService()
    const config = visionService.getConfig()

    console.log('Vision service configuration:', JSON.stringify(config, null, 2))

    if (!config.isConfigured) {
      return NextResponse.json({
        success: false,
        message: 'Google Vision API not configured',
        config
      })
    }

    console.log('Starting reverse image search...')
    const startTime = Date.now()

    try {
      const results = await visionService.reverseImageSearch(imageUrl)
      const endTime = Date.now()

      console.log(`Search completed in ${endTime - startTime}ms`)
      console.log(`Found ${results.length} results`)

      // Log detailed results
      results.forEach((result, index) => {
        console.log(`Result ${index + 1}:`, JSON.stringify(result, null, 2))
      })

      return NextResponse.json({
        success: true,
        message: 'Google Vision search completed',
        searchDetails: {
          imageUrl,
          searchTime: `${endTime - startTime}ms`,
          totalResults: results.length
        },
        results: results,
        config: {
          isConfigured: config.isConfigured,
          projectId: config.projectId,
          hasCredentials: config.hasCredentials
        }
      })

    } catch (searchError) {
      console.error('Vision search error:', searchError)

      return NextResponse.json({
        success: false,
        message: 'Vision search failed',
        error: searchError instanceof Error ? searchError.message : 'Unknown search error',
        stack: searchError instanceof Error ? searchError.stack : undefined,
        config
      })
    }

  } catch (error) {
    console.error('Detailed Vision test error:', error)
    return NextResponse.json({
      success: false,
      message: 'Vision test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        message: 'imageUrl required'
      }, { status: 400 })
    }

    // Same logic as GET but with POST body
    const visionService = new GoogleVisionService()
    const results = await visionService.reverseImageSearch(imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      results,
      totalResults: results.length
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}