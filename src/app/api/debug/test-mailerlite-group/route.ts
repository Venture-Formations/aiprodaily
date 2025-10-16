import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get the review group ID from settings
    const { data: setting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_reviewGroupId')
      .single()

    const reviewGroupId = setting?.value

    if (!reviewGroupId) {
      return NextResponse.json({
        success: false,
        error: 'No review group ID configured'
      }, { status: 400 })
    }

    // Test the MailerLite API with this group ID
    const apiKey = process.env.MAILERLITE_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'MailerLite API key not configured'
      }, { status: 500 })
    }

    console.log('Testing MailerLite group ID:', reviewGroupId)

    // Try to get the group details
    const response = await fetch(`https://connect.mailerlite.com/api/groups/${reviewGroupId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        groupId: reviewGroupId,
        statusCode: response.status,
        error: 'Group ID is invalid or does not exist in MailerLite',
        mailerliteError: data,
        suggestion: 'Please check your MailerLite account and get the correct Group ID'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      groupId: reviewGroupId,
      groupDetails: data,
      message: 'Group ID is valid!'
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
