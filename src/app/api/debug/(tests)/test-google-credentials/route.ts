import { NextRequest, NextResponse } from 'next/server'
import { GoogleVisionService } from '@/lib/google-vision'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Google Credentials Debug ===')

    // Check environment variables
    const hasCredentialsJson = !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
    const hasProjectId = !!process.env.GOOGLE_CLOUD_PROJECT_ID
    const hasKeyFilename = !!process.env.GOOGLE_APPLICATION_CREDENTIALS

    console.log('Environment check:')
    console.log('- GOOGLE_CLOUD_CREDENTIALS_JSON:', hasCredentialsJson)
    console.log('- GOOGLE_CLOUD_PROJECT_ID:', hasProjectId)
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', hasKeyFilename)

    if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
      const credString = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
      console.log('Credentials string length:', credString.length)
      console.log('First 100 chars:', credString.substring(0, 100))
      console.log('Contains escaped newlines:', credString.includes('\\n'))
      console.log('Contains actual newlines:', credString.includes('\n'))
    }

    // Test parsing strategies
    const visionService = new GoogleVisionService()
    const config = visionService.getConfig()

    console.log('Vision service config:', config)

    return NextResponse.json({
      success: true,
      environment: {
        hasCredentialsJson,
        hasProjectId,
        hasKeyFilename,
        credentialsLength: process.env.GOOGLE_CLOUD_CREDENTIALS_JSON?.length || 0
      },
      visionConfig: config,
      message: 'Check server logs for detailed credential analysis'
    })

  } catch (error) {
    console.error('Google credentials debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Check server logs for detailed error analysis'
    })
  }
}