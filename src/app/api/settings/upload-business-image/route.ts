import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'
import { PUBLICATION_ID } from '@/lib/config'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/upload-business-image' },
  async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !['header', 'logo', 'website_header'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!file.type || !allowedTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    const storage = new SupabaseImageStorage()
    const publicUrl = await storage.uploadBusinessImage(
      buffer,
      type as 'header' | 'logo' | 'website_header',
      PUBLICATION_ID
    )

    if (!publicUrl) {
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: `${type === 'logo' ? 'Logo' : type === 'website_header' ? 'Website header' : 'Header'} image uploaded successfully`
    })
  }
)
