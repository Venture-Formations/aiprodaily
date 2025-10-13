import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Upload advertisement image to GitHub
 * POST /api/ads/upload-image
 *
 * Security:
 * - Requires authentication (user must be logged in)
 * - Validates file size (max 5MB)
 * - Validates file type (images only)
 * - Rate-limited by file size restrictions
 */
export async function POST(request: NextRequest) {
  // Authentication check
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

    // Validate file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!imageFile.type || !allowedTypes.includes(imageFile.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Content = buffer.toString('base64')

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `ad-${timestamp}.jpg`
    const path = `advertisements/${filename}`

    // Upload to GitHub
    const githubToken = process.env.GITHUB_TOKEN
    const githubOwner = process.env.GITHUB_OWNER || 'VFDavid'
    const githubRepo = process.env.GITHUB_REPO || 'st-cloud-scoop-images'

    const githubUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${path}`

    const githubResponse = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add advertisement image: ${filename}`,
        content: base64Content,
        branch: 'main'
      })
    })

    if (!githubResponse.ok) {
      const error = await githubResponse.text()
      console.error('GitHub upload failed:', error)
      throw new Error(`GitHub upload failed: ${githubResponse.statusText}`)
    }

    const githubData = await githubResponse.json()
    const imageUrl = githubData.content.download_url

    return NextResponse.json({ url: imageUrl })

  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    )
  }
}
