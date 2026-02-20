import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { STORAGE_PUBLIC_URL } from '@/lib/config'
import { optimizeBuffer } from '@/lib/tinify-service'

/**
 * Upload advertisement image to Supabase Storage (optimized via Tinify)
 * POST /api/ads/upload-image
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in to upload images.' },
      { status: 401 }
    )
  }

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!imageFile.type || !allowedTypes.includes(imageFile.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const rawBuffer = Buffer.from(arrayBuffer)

    // Optimize via Tinify (resize to newsletter width, compress)
    const buffer = await optimizeBuffer(rawBuffer, { preset: 'newsletter' })

    const timestamp = Date.now()
    const ext = imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `ad-${timestamp}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('ad-images')
      .upload(filename, buffer, {
        contentType: imageFile.type,
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      console.error('[Ads] Supabase Storage upload failed:', uploadError)
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const publicUrl = `${STORAGE_PUBLIC_URL}/ad-images/${filename}`

    return NextResponse.json({ url: publicUrl })

  } catch (error) {
    console.error('[Ads] Image upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    )
  }
}
