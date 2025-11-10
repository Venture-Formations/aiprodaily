import { NextRequest, NextResponse } from 'next/server'
import { GoogleVisionService } from '@/lib/google-vision'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
    }

    console.log('=== RAW Vision API Test ===')
    console.log('Image URL:', imageUrl)

    const visionService = new GoogleVisionService()

    // Call the Vision API directly and return the raw response
    const results = await visionService.reverseImageSearch(imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'Check Vercel function logs to see raw Vision API response',
      processedResults: results,
      resultCount: results.length
    })

  } catch (error) {
    console.error('Raw Vision test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}