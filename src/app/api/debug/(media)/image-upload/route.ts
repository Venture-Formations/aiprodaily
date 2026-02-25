import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(media)/image-upload' },
  async ({ logger }) => {
  try {
    console.log('=== SUPABASE IMAGE UPLOAD DEBUG ===')

    const storage = new SupabaseImageStorage()

    const testImageUrl = 'https://picsum.photos/800/600'

    console.log('Testing image upload with sample URL...')
    const uploadResult = await storage.uploadImage(testImageUrl, 'Test Debug Upload')
    console.log('Upload result:', uploadResult)

    return NextResponse.json({
      debug: 'Supabase Image Upload Test',
      upload: {
        testUrl: testImageUrl,
        result: uploadResult,
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to run debug test'
    }, { status: 500 })
  }
  }
)
