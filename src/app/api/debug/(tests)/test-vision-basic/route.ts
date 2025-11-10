import { NextRequest, NextResponse } from 'next/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { GoogleAuth } from 'google-auth-library'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Basic Vision API Test ===')

    // Test if credentials work
    let credentials = undefined
    if (process.env.GOOGLE_CLOUD_TYPE && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
      console.log('Using individual environment variables')
      credentials = {
        type: process.env.GOOGLE_CLOUD_TYPE,
        project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
        private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'No individual environment variables found'
      })
    }

    console.log('Credentials configured:', !!credentials)
    console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID)

    // Initialize Vision client
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: credentials,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    })

    const visionClient = new ImageAnnotatorClient({
      auth: auth,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    })

    console.log('Vision client initialized')

    // Test with a simple web detection call
    const testImageUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'
    console.log('Testing web detection with:', testImageUrl)

    const [result] = await visionClient.annotateImage({
      image: { source: { imageUri: testImageUrl } },
      features: [
        { type: 'WEB_DETECTION', maxResults: 10 }
      ]
    })

    console.log('Vision API call completed')
    console.log('Web detection result:', JSON.stringify(result.webDetection, null, 2))

    const webDetection = result.webDetection
    const pagesWithMatches = webDetection?.pagesWithMatchingImages || []
    const webEntities = webDetection?.webEntities || []
    const visuallySimilar = webDetection?.visuallySimilarImages || []

    return NextResponse.json({
      success: true,
      message: 'Vision API working',
      testImage: testImageUrl,
      results: {
        pagesWithMatchingImages: pagesWithMatches.length,
        webEntities: webEntities.length,
        visuallySimilarImages: visuallySimilar.length,
        samplePage: pagesWithMatches[0] || null,
        sampleEntity: webEntities[0] || null,
        sampleSimilar: visuallySimilar[0] || null
      },
      rawWebDetection: webDetection
    })

  } catch (error) {
    console.error('Basic Vision test error:', error)
    return NextResponse.json({
      success: false,
      message: 'Vision API test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}