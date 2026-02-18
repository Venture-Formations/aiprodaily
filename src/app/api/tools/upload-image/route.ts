import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { STORAGE_PUBLIC_URL } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const fileName = request.nextUrl.searchParams.get('fileName')

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('tool-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (error) {
      console.error('[Upload] Supabase storage error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build public URL using custom domain if configured
    const publicUrl = `${STORAGE_PUBLIC_URL}/tool-images/${fileName}`

    return NextResponse.json({
      success: true,
      path: data.path,
      url: publicUrl
    })
  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
