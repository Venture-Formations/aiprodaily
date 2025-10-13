import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('=== SETTING UP SUPABASE STORAGE ===')

    // Create the newsletter-images bucket
    const { data: bucket, error: createError } = await supabaseAdmin.storage
      .createBucket('newsletter-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      })

    if (createError && createError.message !== 'Bucket already exists') {
      console.error('Failed to create bucket:', createError)
      return NextResponse.json({
        success: false,
        error: createError.message
      }, { status: 500 })
    }

    console.log('Bucket created or already exists:', bucket)

    return NextResponse.json({
      success: true,
      message: 'Supabase Storage bucket "newsletter-images" is ready',
      bucket: bucket,
      note: 'You can now process RSS feeds and images will be hosted in Supabase Storage'
    })

  } catch (error) {
    console.error('Storage setup error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to setup Supabase Storage'
    }, { status: 500 })
  }
}