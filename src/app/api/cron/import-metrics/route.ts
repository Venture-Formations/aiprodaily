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
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: campaigns, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id')
      .eq('status', 'sent')
      .gte('final_sent_at', thirtyDaysAgo.toISOString())

    if (error) {
      throw new Error(`Failed to fetch campaigns: ${error.message}`)
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        message: 'No sent campaigns to import metrics for',
        timestamp: new Date().toISOString()
      })
    }

    const mailerLiteService = new MailerLiteService()
    let successCount = 0
    let errorCount = 0

    // Import metrics for each campaign
    for (const campaign of campaigns) {
      try {
        await mailerLiteService.importCampaignMetrics(campaign.id)
        successCount++
      } catch (error) {
        console.error(`Failed to import metrics for campaign ${campaign.id}:`, error)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Metrics import completed',
      processed: campaigns.length,
      successful: successCount,
      failed: errorCount,
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