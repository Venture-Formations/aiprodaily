import { NextRequest, NextResponse } from 'next/server'
import { GoogleVisionService } from '@/lib/google-vision'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Simple Google Vision Test ===')

    // Test simple initialization
    const visionService = new GoogleVisionService()
    const config = visionService.getConfig()

    console.log('Vision service configuration:', config)

    // Test simple image analysis
    if (config.isConfigured) {
      try {
        console.log('Testing Vision API with sample image...')
        // Use a simple, public image for testing
        const testImageUrl = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'

        const results = await visionService.reverseImageSearch(testImageUrl)

        return NextResponse.json({
          success: true,
          message: 'Google Vision API is working!',
          config: config,
          testResults: {
            imageUrl: testImageUrl,
            resultsFound: results.length,
            sampleResult: results[0] || null
          }
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: 'Google Vision API initialization succeeded but search failed',
          config: config,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Google Vision API not properly configured',
        config: config,
        issues: {
          hasCredentials: config.hasCredentials,
          hasProjectId: !!config.projectId
        }
      })
    }

  } catch (error) {
    console.error('Simple Vision test error:', error)
    return NextResponse.json({
      success: false,
      message: 'Vision API test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}