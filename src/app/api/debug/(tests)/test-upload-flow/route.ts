import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing complete upload flow...')

    // Step 1: Test upload URL generation
    const uploadRequest = {
      filename: 'test-debug.jpg',
      content_type: 'image/jpeg',
      size: 1000
    }

    const uploadUrlResponse = await fetch(`${request.nextUrl.origin}/api/images/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploadRequest)
    })

    if (!uploadUrlResponse.ok) {
      const error = await uploadUrlResponse.text()
      return NextResponse.json({
        step: 'upload_url_generation',
        error: 'Failed to generate upload URL',
        details: error,
        status: uploadUrlResponse.status
      }, { status: 500 })
    }

    const uploadData = await uploadUrlResponse.json()
    console.log('Upload URL generated:', uploadData)

    // Step 2: Test if we can reach the signed URL
    try {
      const urlTest = await fetch(uploadData.upload_url, {
        method: 'HEAD'
      })
      console.log('Signed URL test:', urlTest.status, urlTest.statusText)
    } catch (urlError) {
      console.error('Signed URL test failed:', urlError)
    }

    // Step 3: Check if image record was created in database
    const { data: imageRecord, error: dbError } = await supabaseAdmin
      .from('images')
      .select('*')
      .eq('id', uploadData.image_id)
      .single()

    if (dbError) {
      return NextResponse.json({
        step: 'database_record_check',
        error: 'Image record not found in database',
        details: dbError,
        uploadData
      }, { status: 500 })
    }

    // Step 4: Test storage bucket access
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
    const imagesBucket = buckets?.find(b => b.name === 'images')

    // Step 5: Test if we can list files in the bucket
    let bucketContents = null
    try {
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from('images')
        .list('original', { limit: 5 })

      bucketContents = { files: files?.length || 0, error: listError }
    } catch (listError) {
      bucketContents = { error: listError }
    }

    return NextResponse.json({
      success: true,
      steps: {
        upload_url_generation: {
          success: true,
          data: uploadData
        },
        database_record: {
          success: true,
          record: imageRecord
        },
        storage_bucket: {
          exists: !!imagesBucket,
          bucket_info: imagesBucket,
          contents: bucketContents
        }
      },
      test_upload_url: uploadData.upload_url,
      next_steps: [
        '1. Try uploading a small file to the signed URL',
        '2. Check if the file appears in Supabase storage',
        '3. Test the AI analysis endpoint',
        '4. Verify the complete upload component flow'
      ]
    })

  } catch (error) {
    console.error('Upload flow test error:', error)
    return NextResponse.json({
      error: 'Upload flow test failed',
      details: error instanceof Error ? error.message : error
    }, { status: 500 })
  }
}