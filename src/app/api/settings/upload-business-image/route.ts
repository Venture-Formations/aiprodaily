import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('🖼️ [Upload] Starting image upload...')

    const session = await getServerSession(authOptions)
    if (!session) {
      console.log('❌ [Upload] Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'header' or 'logo'

    console.log('📄 [Upload] File received:', file?.name, 'Type:', type)

    if (!file) {
      console.log('❌ [Upload] No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !['header', 'logo'].includes(type)) {
      console.log('❌ [Upload] Invalid type parameter:', type)
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    // Read file as base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Content = buffer.toString('base64')

    console.log('📦 [Upload] File converted to base64, size:', buffer.length, 'bytes')

    // Generate filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `business-${type}-${timestamp}.${extension}`
    const githubPath = `business/${filename}`

    console.log('🏷️ [Upload] Generated filename:', filename)

    // Upload to GitHub
    const githubToken = process.env.GITHUB_TOKEN
    const githubRepo = process.env.GITHUB_REPO || 'Venture-Formations/aiprodaily'
    const githubBranch = process.env.GITHUB_BRANCH || 'master'

    if (!githubToken) {
      console.error('❌ [Upload] GITHUB_TOKEN not configured')
      return NextResponse.json({ error: 'GitHub configuration missing' }, { status: 500 })
    }

    const githubUrl = `https://api.github.com/repos/${githubRepo}/contents/${githubPath}`
    console.log('🚀 [Upload] Uploading to GitHub:', githubUrl)

    const githubResponse = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `Upload ${type} image: ${filename}`,
        content: base64Content,
        branch: githubBranch
      })
    })

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text()
      console.error('❌ [Upload] GitHub upload failed:', githubResponse.status, errorText)
      return NextResponse.json({
        error: 'Failed to upload to GitHub',
        details: errorText
      }, { status: 500 })
    }

    const githubData = await githubResponse.json()
    console.log('✅ [Upload] GitHub upload successful')

    // Generate the raw content URL
    const publicUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/${githubPath}`
    console.log('🔗 [Upload] Public URL:', publicUrl)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: `${type === 'header' ? 'Header' : 'Logo'} image uploaded successfully`
    })

  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
