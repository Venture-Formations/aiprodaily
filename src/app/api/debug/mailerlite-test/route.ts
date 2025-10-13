import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

export async function GET(request: NextRequest) {
  try {
    console.log('=== MAILERLITE DIAGNOSTIC TEST ===')

    // Check environment variables
    const hasApiKey = !!process.env.MAILERLITE_API_KEY
    const hasReviewGroupId = !!process.env.MAILERLITE_REVIEW_GROUP_ID
    const apiKeyPrefix = process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...'

    console.log('Environment variables:', {
      hasApiKey,
      hasReviewGroupId,
      apiKeyPrefix,
      reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID
    })

    if (!hasApiKey) {
      return NextResponse.json({
        success: false,
        error: 'MAILERLITE_API_KEY not found in environment variables'
      }, { status: 500 })
    }

    if (!hasReviewGroupId) {
      return NextResponse.json({
        success: false,
        error: 'MAILERLITE_REVIEW_GROUP_ID not found in environment variables'
      }, { status: 500 })
    }

    // Test API connection
    const mailerliteClient = axios.create({
      baseURL: MAILERLITE_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log('Testing MailerLite API connection...')

    // Test 1: Simple API authentication test
    try {
      // Try the campaigns endpoint first (most commonly available)
      const campaignsResponse = await mailerliteClient.get('/campaigns?limit=1')
      console.log('Campaigns endpoint test successful:', campaignsResponse.status)

      // If that works, the API key is valid
      console.log('API authentication successful')

    } catch (error: any) {
      console.error('API authentication test failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })

      // Try to diagnose the specific issue
      if (error.response?.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Invalid MailerLite API key - check your MAILERLITE_API_KEY environment variable',
          details: {
            status: error.response?.status,
            data: error.response?.data
          }
        }, { status: 500 })
      } else if (error.response?.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'MailerLite API endpoint not found - possible API version issue',
          details: {
            status: error.response?.status,
            data: error.response?.data,
            baseUrl: MAILERLITE_API_BASE
          }
        }, { status: 500 })
      } else {
        return NextResponse.json({
          success: false,
          error: 'Failed to connect to MailerLite API',
          details: {
            status: error.response?.status,
            data: error.response?.data
          }
        }, { status: 500 })
      }
    }

    // Test 2: Get groups to verify review group exists
    try {
      const groupsResponse = await mailerliteClient.get('/groups')
      console.log('Groups test successful:', groupsResponse.status)

      const groups = groupsResponse.data.data
      const reviewGroup = groups.find((group: any) => group.id === process.env.MAILERLITE_REVIEW_GROUP_ID)

      if (!reviewGroup) {
        return NextResponse.json({
          success: false,
          error: `Review group ID ${process.env.MAILERLITE_REVIEW_GROUP_ID} not found`,
          availableGroups: groups.map((g: any) => ({ id: g.id, name: g.name }))
        }, { status: 400 })
      }

      console.log('Review group found:', reviewGroup.name)

    } catch (error: any) {
      console.error('Groups test failed:', error.response?.data)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch groups from MailerLite',
        details: error.response?.data
      }, { status: 500 })
    }

    // Test 3: Try creating a minimal test campaign (but don't send it)
    const testCampaignData = {
      name: `Test Campaign - ${new Date().toISOString()}`,
      type: 'regular',
      emails: [{
        subject: '🍦 Test Subject',
        from_name: 'St. Cloud Scoop',
        from: 'scoop@stcscoop.com',
        content: '<html><body><h1>Test Content</h1></body></html>',
      }],
      groups: [process.env.MAILERLITE_REVIEW_GROUP_ID]
      // Note: No delivery_schedule means it won't be sent
    }

    try {
      console.log('Testing campaign creation...')
      const campaignResponse = await mailerliteClient.post('/campaigns', testCampaignData)
      console.log('Campaign creation test successful:', campaignResponse.status)

      // Immediately delete the test campaign
      const campaignId = campaignResponse.data.data.id
      await mailerliteClient.delete(`/campaigns/${campaignId}`)
      console.log('Test campaign deleted')

    } catch (error: any) {
      console.error('Campaign creation test failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      return NextResponse.json({
        success: false,
        error: 'Failed to create test campaign',
        details: {
          status: error.response?.status,
          data: error.response?.data,
          requestData: testCampaignData
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'All MailerLite tests passed successfully',
      environment: {
        hasApiKey,
        hasReviewGroupId,
        apiKeyPrefix
      }
    })

  } catch (error) {
    console.error('MailerLite diagnostic error:', error)
    return NextResponse.json({
      success: false,
      error: 'Diagnostic test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}