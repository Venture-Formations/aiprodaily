import { NextRequest, NextResponse } from 'next/server'
import { GitHubImageStorage } from '@/lib/github-storage'

export async function GET(request: NextRequest) {
  try {
    console.log('=== GITHUB IMAGE UPLOAD DEBUG ===')

    // Check environment variables
    const hasGithubToken = !!process.env.GITHUB_TOKEN
    const hasGithubOwner = !!process.env.GITHUB_OWNER
    const hasGithubRepo = !!process.env.GITHUB_REPO

    console.log('Environment variables:', {
      hasGithubToken,
      githubOwner: process.env.GITHUB_OWNER,
      githubRepo: process.env.GITHUB_REPO
    })

    // Test creating GitHubImageStorage instance
    let storageInstance = null
    let storageError = null
    try {
      storageInstance = new GitHubImageStorage()
      console.log('GitHubImageStorage instance created successfully')
    } catch (error) {
      storageError = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to create GitHubImageStorage instance:', storageError)
    }

    // Test with a sample Facebook image URL from recent posts
    const testImageUrl = 'https://scontent-cdg4-2.xx.fbcdn.net/v/t39.30808-6/549637389_1050772156725334_4032655329568456100_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=7b2446&_nc_ohc=pOZZQWJJrlcQ7kNvFgFYeLM&_nc_ht=scontent-cdg4-2.xx&oh=00_AYDuJcRKQ9HvJCLdJPa3SjXwSVCnj1-OhWdQj6PVOaFnfg&oe=66F0B9E4'

    let uploadResult = null
    let uploadError = null

    if (storageInstance) {
      try {
        console.log('Testing image upload with sample Facebook URL...')
        uploadResult = await storageInstance.uploadImage(testImageUrl, 'Test Debug Upload')
        console.log('Upload result:', uploadResult)
      } catch (error) {
        uploadError = error instanceof Error ? error.message : 'Unknown error'
        console.error('Upload failed:', uploadError)
      }
    }

    return NextResponse.json({
      debug: 'GitHub Image Upload Test',
      environment: {
        hasGithubToken,
        githubOwner: process.env.GITHUB_OWNER,
        githubRepo: process.env.GITHUB_REPO
      },
      storage: {
        instanceCreated: !!storageInstance,
        error: storageError
      },
      upload: {
        testUrl: testImageUrl,
        result: uploadResult,
        error: uploadError
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to run debug test'
    }, { status: 500 })
  }
}