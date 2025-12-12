import { NextRequest, NextResponse } from 'next/server'
import { emailMetricsService } from '@/lib/email-metrics'

/**
 * Import email metrics from the appropriate provider (SendGrid or MailerLite)
 *
 * This cron job uses the hybrid EmailMetricsService which automatically
 * selects the correct provider based on which campaign ID is present:
 * - sendgrid_singlesend_id → Fetch from SendGrid
 * - mailerlite_issue_id → Fetch from MailerLite (legacy)
 */

// Handle GET requests from Vercel cron
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const secret = searchParams.get('secret')

  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Metrics Import] Starting hybrid metrics import')

    const result = await emailMetricsService.importMetricsForRecentIssues(30)

    console.log(`[Metrics Import] Complete: ${result.successful} successful, ${result.skipped} skipped, ${result.failed} failed`)

    return NextResponse.json({
      success: true,
      message: 'Metrics import completed (hybrid provider)',
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Metrics Import] Failed:', error)
    return NextResponse.json({
      error: 'Metrics import failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle POST requests for manual triggers with auth header
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Metrics Import] Starting hybrid metrics import (manual trigger)')

    const result = await emailMetricsService.importMetricsForRecentIssues(30)

    console.log(`[Metrics Import] Complete: ${result.successful} successful, ${result.skipped} skipped, ${result.failed} failed`)

    return NextResponse.json({
      success: true,
      message: 'Metrics import completed (hybrid provider)',
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Metrics Import] Failed:', error)
    return NextResponse.json({
      error: 'Metrics import failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
