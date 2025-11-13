import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting scheduled metrics import...')

    // Get campaigns that were sent in the last 30 days
    // final_sent_at is stored as a timestamp, so we use ISO string for comparison
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

    const { data: issues, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, final_sent_at')
      .eq('status', 'sent')
      .not('final_sent_at', 'is', null)
      .gte('final_sent_at', thirtyDaysAgoISO)

    if (error) {
      throw new Error(`Failed to fetch issues: ${error.message}`)
    }

    if (!issues || issues.length === 0) {
      return NextResponse.json({
        message: 'No sent issues to import metrics for',
        timestamp: new Date().toISOString()
      })
    }

    console.log(`Found ${issues.length} sent issues to import metrics for`)

    const mailerLiteService = new MailerLiteService()
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Import metrics for each issue
    for (const issue of issues) {
      try {
        console.log(`Importing metrics for issue ${issue.id}...`)
        await mailerLiteService.importissueMetrics(issue.id)
        successCount++
        console.log(`Successfully imported metrics for issue ${issue.id}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to import metrics for issue ${issue.id}:`, errorMessage)
        errors.push(`Issue ${issue.id}: ${errorMessage}`)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Metrics import completed',
      processed: issues.length,
      successful: successCount,
      failed: errorCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scheduled metrics import failed:', error)

    return NextResponse.json({
      error: 'Metrics import failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// For manual testing
export async function GET() {
  return NextResponse.json({
    message: 'Metrics import cron endpoint is active',
    timestamp: new Date().toISOString(),
    schedule: 'Daily at 6:00 AM CT'
  })
}