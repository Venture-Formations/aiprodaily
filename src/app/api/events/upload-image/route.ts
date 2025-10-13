import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { GitHubImageStorage } from '@/lib/github-storage'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const originalBlob = formData.get('original') as Blob
    const croppedBlob = formData.get('cropped') as Blob
    const eventTitle = formData.get('eventTitle') as string

    console.log('Upload request received:', {
      hasOriginal: !!originalBlob,
      hasOriginalSize: originalBlob?.size,
      hasCropped: !!croppedBlob,
      hasCroppedSize: croppedBlob?.size,
      hasTitle: !!eventTitle,
      title: eventTitle
    })

    if (!originalBlob || !croppedBlob || !eventTitle) {
      console.error('Missing required fields:', {
        hasOriginal: !!originalBlob,
        hasCropped: !!croppedBlob,
        hasTitle: !!eventTitle
      })
      return NextResponse.json({
        error: 'Missing required fields',
        details: {
          hasOriginal: !!originalBlob,
          hasCropped: !!croppedBlob,
          hasTitle: !!eventTitle
        }
      }, { status: 400 })
    }

    // Initialize GitHub storage
    const githubStorage = new GitHubImageStorage()

    // Create safe filename from event title
    const timestamp = Date.now()
    const safeTitle = eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)

    // Generate unique ID for this event image
    const eventImageId = `${safeTitle}-${timestamp}`
    const originalPath = `public-events/originals/${eventImageId}.jpg`

    console.log('Uploading original to Supabase Storage...')

    // Upload original image to Supabase Storage
    const { data: originalData, error: originalError } = await supabaseAdmin.storage
      .from('images')
      .upload(originalPath, originalBlob, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (originalError) {
      console.error('Original upload error:', originalError)
      throw new Error(`Failed to upload original image: ${originalError.message}`)
    }

    // Get public URL for original
    const { data: originalUrlData } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(originalPath)

    console.log('Uploading cropped variant to GitHub...')

    // Convert cropped Blob to Buffer for GitHub upload
    const croppedBuffer = Buffer.from(await croppedBlob.arrayBuffer())

    // Upload cropped image to GitHub as variant
    const githubUrl = await githubStorage.uploadImageVariant(
      croppedBuffer,
      eventImageId,
      '900x720',
      `Event image for: ${eventTitle}`
    )

    if (!githubUrl) {
      console.error('GitHub upload failed')
      // Try to clean up original image from Supabase
      await supabaseAdmin.storage.from('images').remove([originalPath])
      throw new Error('Failed to upload cropped image to GitHub')
    }

    // Get CDN URL for cropped variant
    const croppedCdnUrl = githubStorage.getCdnUrl(eventImageId, '900x720')

    console.log('Upload successful:', {
      originalUrl: originalUrlData.publicUrl,
      croppedUrl: croppedCdnUrl
    })

    // Return the public URLs
    return NextResponse.json({
      original_url: originalUrlData.publicUrl,
      cropped_url: croppedCdnUrl,
    })

  } catch (error) {
    console.error('Image upload failed:', error)
    return NextResponse.json({
      error: 'Image upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
