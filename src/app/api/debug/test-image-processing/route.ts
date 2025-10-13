import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== TEST IMAGE PROCESSING ===')

    // First, try to create the bucket if it doesn't exist
    const { data: newBucket, error: createError } = await supabaseAdmin.storage
      .createBucket('newsletter-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      })

    console.log('Create bucket result:', newBucket, 'Error:', createError)

    // Test downloading and storing a simple image
    const testImageUrl = 'https://via.placeholder.com/300x200.jpg'
    const testFileName = 'test-image.jpg'

    try {
      console.log('Testing image download from:', testImageUrl)

      const response = await fetch(testImageUrl, {
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()
      console.log('Downloaded image, size:', buffer.byteLength)

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('newsletter-images')
        .upload(`articles/${testFileName}`, buffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        })

      console.log('Upload result:', data, 'Error:', error)

      if (data) {
        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('newsletter-images')
          .getPublicUrl(`articles/${testFileName}`)

        console.log('Public URL:', urlData.publicUrl)

        return NextResponse.json({
          success: true,
          bucketCreated: !createError,
          uploadSuccessful: !error,
          testImageUrl: urlData.publicUrl,
          uploadData: data,
          error: error
        })
      } else {
        return NextResponse.json({
          success: false,
          error: error,
          message: 'Failed to upload test image'
        })
      }

    } catch (downloadError) {
      console.error('Image download/upload error:', downloadError)
      return NextResponse.json({
        success: false,
        error: downloadError instanceof Error ? downloadError.message : 'Unknown download error'
      })
    }

  } catch (error) {
    console.error('Test image processing error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to test image processing'
    }, { status: 500 })
  }
}