import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing image storage setup...')

    // Check if images bucket exists
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()

    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      return NextResponse.json({
        error: 'Failed to list storage buckets',
        details: bucketsError
      }, { status: 500 })
    }

    const imagesBucket = buckets?.find(bucket => bucket.name === 'images')

    if (!imagesBucket) {
      console.log('Images bucket does not exist, attempting to create...')

      // Try to create the bucket
      const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket('images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 10485760 // 10MB
      })

      if (createError) {
        console.error('Error creating bucket:', createError)
        return NextResponse.json({
          error: 'Failed to create images bucket',
          details: createError,
          availableBuckets: buckets?.map(b => b.name) || []
        }, { status: 500 })
      }

      console.log('Images bucket created successfully:', newBucket)
    }

    // Test creating a signed upload URL
    try {
      const testObjectKey = `images/original/test-${Date.now()}.jpg`
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('images')
        .createSignedUploadUrl(testObjectKey, {
          upsert: true
        })

      if (uploadError) {
        console.error('Error creating signed upload URL:', uploadError)
        return NextResponse.json({
          error: 'Failed to create signed upload URL',
          details: uploadError,
          bucketExists: !!imagesBucket,
          bucketInfo: imagesBucket
        }, { status: 500 })
      }

      // Test images table exists
      const { data: testQuery, error: tableError } = await supabaseAdmin
        .from('images')
        .select('id')
        .limit(1)

      if (tableError) {
        console.error('Error querying images table:', tableError)
        return NextResponse.json({
          error: 'Images table not found or not accessible',
          details: tableError,
          bucketExists: !!imagesBucket,
          signedUrlWorks: !!uploadData
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        bucketExists: !!imagesBucket,
        bucketInfo: imagesBucket,
        signedUrlWorks: !!uploadData,
        testUploadUrl: uploadData?.signedUrl,
        imagesTableExists: true,
        availableBuckets: buckets?.map(b => ({ name: b.name, public: b.public })) || []
      })

    } catch (testError) {
      console.error('Error during storage test:', testError)
      return NextResponse.json({
        error: 'Storage test failed',
        details: testError instanceof Error ? testError.message : testError,
        bucketExists: !!imagesBucket
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Debug storage test error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : error
    }, { status: 500 })
  }
}