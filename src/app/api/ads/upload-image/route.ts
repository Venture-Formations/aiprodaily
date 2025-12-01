import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Octokit } from '@octokit/rest'

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
    const path = `public/images/advertisements/${filename}`

    // Upload to GitHub using Octokit
    const githubToken = process.env.GITHUB_TOKEN
    const githubOwner = process.env.GITHUB_OWNER || 'Venture-Formations'
    const githubRepo = process.env.GITHUB_REPO || 'aiprodaily'

    if (!githubToken) {
      throw new Error('GitHub token not configured')
    }

    const octokit = new Octokit({
      auth: githubToken,
    })

    // Parse repo path if it contains owner (e.g., "Venture-Formations/aiprodaily")
    let owner = githubOwner
    let repo = githubRepo

    if (githubRepo.includes('/')) {
      const parts = githubRepo.split('/')
      owner = parts[0]
      repo = parts[1]
    }

    const uploadResponse = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Add advertisement image: ${filename}`,
      content: base64Content,
    })

    if (!uploadResponse.data.content?.download_url) {
      console.error('GitHub upload failed: No download URL returned')
      throw new Error('GitHub upload failed: No download URL')
    }

    const imageUrl = uploadResponse.data.content.download_url

    return NextResponse.json({ url: imageUrl })

  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    )
  }
}
