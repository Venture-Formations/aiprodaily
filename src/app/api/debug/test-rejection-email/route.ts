import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail-service'

export async function GET(request: NextRequest) {
  try {
    const gmail = new GmailService()

    // Get reason from query parameter or use default
    const reason = request.nextUrl.searchParams.get('reason') ||
      'The event details provided did not meet our submission guidelines. Please ensure all required information is accurate and complete.'

    // Test data for "Super Cool Featured Event"
    const testEvent = {
      title: 'Super Cool Featured Event',
      description: 'This is a test event submission to verify rejection email notifications are working correctly.',
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      submitter_email: request.nextUrl.searchParams.get('email') || 'test@example.com',
      submitter_name: 'Test User'
    }

    console.log('Sending test rejection email to:', testEvent.submitter_email)
    console.log('With reason:', reason)

    const result = await gmail.sendEventRejectionEmail(testEvent, reason)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test rejection email sent successfully!',
        messageId: result.messageId,
        sentTo: testEvent.submitter_email,
        reason: reason
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to send email',
        details: result.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Test rejection email error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send test rejection email',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
