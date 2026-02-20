import { NextRequest, NextResponse } from 'next/server'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'

/**
 * Test Supabase image upload (replaces old GitHub upload test)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== TESTING SUPABASE IMAGE UPLOAD ===')

    const testImageUrl = 'https://picsum.photos/800/600'

    const storage = new SupabaseImageStorage()

    console.log('Attempting to upload test image...')
    const result = await storage.uploadImage(testImageUrl, 'Supabase Upload Test')

    return NextResponse.json({
      success: !!result,
      message: result ? 'Image upload test successful!' : 'Upload returned null',
      originalUrl: testImageUrl,
      hostedUrl: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Upload test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Image upload test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
