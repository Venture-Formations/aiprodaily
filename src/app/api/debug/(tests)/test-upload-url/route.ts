import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing upload URL generation...')

    // Test upload URL generation
    const testObjectKey = 'original/test-debug.jpg'

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('images')
      .createSignedUploadUrl(testObjectKey, {
        upsert: true
      })

    if (uploadError) {
      console.error('Upload URL generation error:', uploadError)
      return NextResponse.json({
        error: 'Failed to generate upload URL',
        details: uploadError
      }, { status: 500 })
    }

    console.log('Upload URL generated:', uploadData)

    return NextResponse.json({
      success: true,
      upload_url: uploadData.signedUrl,
      token: uploadData.token,
      object_key: testObjectKey,
      message: 'Upload URL generated successfully'
    })

  } catch (error) {
    console.error('Upload URL test error:', error)
    return NextResponse.json({
      error: 'Upload URL test failed',
      details: error instanceof Error ? error.message : error
    }, { status: 500 })
  }
}