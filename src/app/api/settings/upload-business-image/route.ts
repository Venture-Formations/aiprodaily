import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'
import { PUBLICATION_ID } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !['header', 'logo', 'website_header'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
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
      message: `${type === 'logo' ? 'Logo' : 'Header'} image uploaded successfully`
    })

  } catch (error) {
    console.error('[Upload] Business image upload error:', error)
    return NextResponse.json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
