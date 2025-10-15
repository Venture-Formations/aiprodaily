import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'header' or 'logo'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !['header', 'logo'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    // Read file as base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Content = buffer.toString('base64')

    // Generate filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `business-${type}-${timestamp}.${extension}`
    const githubPath = `business/${filename}`

    // Upload to GitHub
    const githubToken = process.env.GITHUB_TOKEN
    const githubRepo = process.env.GITHUB_REPO || 'VFDavid/STCScoop'
    const githubBranch = process.env.GITHUB_BRANCH || 'main'

    if (!githubToken) {
      console.error('GITHUB_TOKEN not configured')
      return NextResponse.json({ error: 'GitHub configuration missing' }, { status: 500 })
    }

    const githubUrl = `https://api.github.com/repos/${githubRepo}/contents/${githubPath}`

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
      console.error('GitHub upload failed:', errorText)
      return NextResponse.json({ error: 'Failed to upload to GitHub' }, { status: 500 })
    }

    const githubData = await githubResponse.json()

    // Generate the raw content URL
    const publicUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/${githubPath}`

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
