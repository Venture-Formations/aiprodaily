import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ImageUploadRequest, ImageUploadResponse } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body: ImageUploadRequest = await request.json()
    const { filename, content_type, size } = body

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(content_type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Generate unique ID and object key
    const imageId = uuidv4()
    const fileExtension = content_type.split('/')[1] === 'jpeg' ? 'jpg' : content_type.split('/')[1]
    const objectKey = `original/${imageId}.${fileExtension}`

    // Create database record first
    const { error: dbError } = await supabaseAdmin
      .from('images')
      .insert({
        id: imageId,
        object_key: objectKey,
        original_file_name: filename,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create image record' },
        { status: 500 }
      )
    }

    // Generate signed upload URL
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('images')
      .createSignedUploadUrl(objectKey, {
        upsert: true
      })

    if (uploadError) {
      console.error('Storage upload URL error:', uploadError)

      // Clean up database record if upload URL generation fails
      await supabaseAdmin
        .from('images')
        .delete()
        .eq('id', imageId)

      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      )
    }

    const response: ImageUploadResponse = {
      upload_url: uploadData.signedUrl,
      object_key: objectKey,
      image_id: imageId
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Upload URL API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}