import { NextRequest, NextResponse } from 'next/server'
import { GitHubImageStorage } from '@/lib/github-storage'

export async function POST(request: NextRequest) {
  try {
    console.log('=== TESTING GITHUB IMAGE UPLOAD ===')

    // Test with a sample Facebook image URL (you can replace with any image URL)
    const testImageUrl = 'https://scontent-ord5-1.xx.fbcdn.net/v/t39.30808-6/546876855_1413026463578627_3361054370504721694_n.jpg?stp=dst-jpg_s1080x2048_tt6&_nc_cat=101&ccb=1-7&_nc_sid=1abd25&_nc_ohc=Nwrz66sr3AcQ7kNvwGkRmK3&_nc_oc=AdlKQS8g8BKAeKPBuuQnq3cxf9af0STLYyrHZyFyaXtlKsu4QxUG3c2Gl7U2Tp8tOIw&_nc_zt=23&_nc_ht=scontent-ord5-1.xx&_nc_gid=yb_vM-y9L8ae_IltFA4D4Q&oh=00_AfYUp5qKgxm4vtoocZUKD0bZrQZrAsZWHa8QPaUiPs_Svg&oe=68D75FA8'

    console.log('Testing GitHub token permissions...')
    console.log('GitHub token prefix:', process.env.GITHUB_TOKEN?.substring(0, 15) + '...')

    const githubStorage = new GitHubImageStorage()

    console.log('Attempting to upload test image...')
    const result = await githubStorage.uploadImage(testImageUrl, 'GitHub Token Test')

    return NextResponse.json({
      success: true,
      message: 'GitHub image upload test successful!',
      originalUrl: testImageUrl,
      githubUrl: result,
      tokenPrefix: process.env.GITHUB_TOKEN?.substring(0, 15) + '...',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('GitHub upload test failed:', error)

    // Extract detailed error information
    let errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      tokenExists: !!process.env.GITHUB_TOKEN,
      tokenPrefix: process.env.GITHUB_TOKEN?.substring(0, 15) + '...'
    }

    // Check for specific GitHub API errors
    if (error instanceof Error && error.message.includes('403')) {
      errorDetails.message = 'GitHub token lacks permissions (403 Forbidden)'
    } else if (error instanceof Error && error.message.includes('401')) {
      errorDetails.message = 'GitHub token is invalid or expired (401 Unauthorized)'
    }

    return NextResponse.json({
      success: false,
      error: 'GitHub image upload test failed',
      details: errorDetails,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}