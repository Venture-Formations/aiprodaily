import { NextRequest, NextResponse } from 'next/server'
import { GoogleVisionService } from '@/lib/google-vision'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const imageUrl = searchParams.get('image_url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'image_url parameter required' },
        { status: 400 }
      )
    }

    console.log('Testing Google Vision with image:', imageUrl)

    const visionService = new GoogleVisionService()
    const config = visionService.getConfig()

    // Check configuration
    if (!config.isConfigured) {
      return NextResponse.json({
        error: 'Google Cloud Vision not configured',
        config: {
          hasProjectId: !!config.projectId,
          hasCredentials: config.hasCredentials,
          environmentVars: {
            GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
            GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
            GOOGLE_CLOUD_CREDENTIALS_JSON: !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
          }
        }
      })
    }

    // Test the Vision API
    const startTime = Date.now()
    const results = await visionService.reverseImageSearch(imageUrl)
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      config,
      test_image_url: imageUrl,
      duration_ms: duration,
      results_count: results.length,
      results: results.slice(0, 5), // Return top 5 results for testing
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Google Vision test error:', error)

    return NextResponse.json({
      error: 'Google Vision test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { image_id } = await request.json()

    if (!image_id) {
      return NextResponse.json(
        { error: 'image_id required' },
        { status: 400 }
      )
    }

    // Get image from database (reuse logic from main endpoint)
    const { supabaseAdmin } = await import('@/lib/supabase')

    const { data: image, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('*')
      .eq('id', image_id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    const imageUrl = image.cdn_url
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL not available' },
        { status: 400 }
      )
    }

    // Test Vision API with this specific image
    const visionService = new GoogleVisionService()
    const startTime = Date.now()
    const results = await visionService.reverseImageSearch(imageUrl)
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      image_id,
      image_url: imageUrl,
      duration_ms: duration,
      results_count: results.length,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Google Vision image test error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}