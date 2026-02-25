import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/env-check' },
  async ({ request, logger }) => {
    // Original env check functionality
    const hasApiKey = !!process.env.HTML_CSS_TO_IMAGE_API_KEY
    const apiKeyLength = process.env.HTML_CSS_TO_IMAGE_API_KEY?.length || 0
    const hasUserId = !!process.env.HTML_CSS_TO_IMAGE_USER_ID
    const userIdLength = process.env.HTML_CSS_TO_IMAGE_USER_ID?.length || 0

    return NextResponse.json({
      hasApiKey,
      apiKeyLength,
      hasUserId,
      userIdLength,
      // Don't expose the actual values
      apiKeyPreview: process.env.HTML_CSS_TO_IMAGE_API_KEY ?
        `${process.env.HTML_CSS_TO_IMAGE_API_KEY.substring(0, 8)}...` :
        'Not set',
      userIdPreview: process.env.HTML_CSS_TO_IMAGE_USER_ID ?
        `${process.env.HTML_CSS_TO_IMAGE_USER_ID.substring(0, 8)}...` :
        'Not set'
    })
  }
)
