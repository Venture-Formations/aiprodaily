import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail-service'

export async function GET(request: NextRequest) {
  try {
    const gmail = new GmailService()

    // Test data for "Super Cool Featured Event"
    const testEvent = {
      title: 'Super Cool Featured Event',
      description: 'This is a test event submission to verify email notifications are working correctly.',
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
      venue: 'Test Venue',
      address: '123 Main St, St. Cloud, MN 56301',
      url: 'https://st-cloud-scoop.vercel.app',
      website: 'https://st-cloud-scoop.vercel.app',
      submitter_email: request.nextUrl.searchParams.get('email') || 'test@example.com',
      submitter_name: 'Test User'
    }

    console.log('Sending test approval email to:', testEvent.submitter_email)

    const result = await gmail.sendEventApprovalEmail(testEvent)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test approval email sent successfully!',
        messageId: result.messageId,
        sentTo: testEvent.submitter_email
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to send email',
        details: result.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send test email',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
