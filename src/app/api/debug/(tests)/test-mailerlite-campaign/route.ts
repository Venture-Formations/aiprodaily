import { NextRequest, NextResponse } from 'next/server'
import { MailerLiteService } from '@/lib/mailerlite'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('Testing MailerLite issue creation with scheduling...')

    // Get the latest issue
    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        )
      `)
      .eq('date', '2025-09-24')
      .single()

    if (error || !issue) {
      return NextResponse.json({
        success: false,
        error: 'No issue found for testing'
      }, { status: 404 })
    }

    // Create a test MailerLite issue with the fixed scheduling
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewissue(issue)

    return NextResponse.json({
      success: true,
      message: 'Test MailerLite issue created with scheduling',
      issueId: issue.id,
      mailerliteissueId: result.issueId,
      result
    })

  } catch (error) {
    console.error('Test issue creation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create test issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}