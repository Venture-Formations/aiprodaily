import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'

/**
 * Upload manual article image to Supabase Storage (optimized via Tinify)
 * POST /api/databases/manual-articles/upload-image
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/manual-articles/upload-image' },
  async ({ request, logger }) => {
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
    const buffer = Buffer.from(arrayBuffer)

    const timestamp = Date.now()
    const extension = imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `article-${timestamp}.${extension}`

    const storage = new SupabaseImageStorage()
    const imageUrl = await storage.uploadBuffer(buffer, filename, 'Manual article image')

    if (!imageUrl) {
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    return NextResponse.json({ url: imageUrl })
  }
)
