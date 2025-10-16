import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get MailerLite-related settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.eq.email_reviewGroupId,key.eq.email_mainGroupId,key.eq.email_fromEmail,key.eq.email_senderName')

    const config: Record<string, string> = {}
    settings?.forEach(s => {
      config[s.key.replace('email_', '')] = s.value
    })

    // Check environment variables
    const hasApiKey = !!process.env.MAILERLITE_API_KEY
    const apiKeyLength = process.env.MAILERLITE_API_KEY?.length || 0

    return NextResponse.json({
      success: true,
      databaseSettings: config,
      environment: {
        hasApiKey,
        apiKeyLength,
        envReviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID || 'not set',
        envMainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID || 'not set'
      },
      validation: {
        reviewGroupIdValid: config.reviewGroupId && config.reviewGroupId.length > 0,
        mainGroupIdValid: config.mainGroupId && config.mainGroupId.length > 0,
        fromEmailValid: config.fromEmail && config.fromEmail.length > 0,
        senderNameValid: config.senderName && config.senderName.length > 0
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
