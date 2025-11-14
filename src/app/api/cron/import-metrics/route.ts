import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

async function executeMetricsImport() {
  console.log('[Import Metrics] Starting scheduled metrics import...')
  console.log('[Import Metrics] Timestamp:', new Date().toISOString())

  // Get campaigns that were sent in the last 30 days
  // final_sent_at is stored as a timestamp, so we use ISO string for comparison
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  console.log('[Import Metrics] Looking for issues sent after:', thirtyDaysAgoISO)

  const { data: issues, error } = await supabaseAdmin
    .from('publication_issues')
    .select('id, final_sent_at')
    .eq('status', 'sent')
    .not('final_sent_at', 'is', null)
    .gte('final_sent_at', thirtyDaysAgoISO)

  if (error) {
    console.error('[Import Metrics] Database query error:', error)
    throw new Error(`Failed to fetch issues: ${error.message}`)
  }

  console.log('[Import Metrics] Database query successful')

  if (!issues || issues.length === 0) {
    console.log('[Import Metrics] No sent issues found in the last 30 days')
    return {
      success: true,
      message: 'No sent issues to import metrics for',
      processed: 0,
      successful: 0,
      failed: 0,
      timestamp: new Date().toISOString()
    }
  }

  console.log(`[Import Metrics] Found ${issues.length} sent issues to import metrics for`)
  console.log('[Import Metrics] Issue IDs:', issues.map(i => i.id).join(', '))

  const mailerLiteService = new MailerLiteService()
  let successCount = 0
  let errorCount = 0
  const errors: string[] = []

  // Import metrics for each issue
  let skippedCount = 0
  
  for (const issue of issues) {
    try {
      console.log(`[Import Metrics] Processing issue ${issue.id} (${issue.final_sent_at})...`)
      const result = await mailerLiteService.importissueMetrics(issue.id)
      
      // Check if campaign was deleted (404 handled gracefully)
      if (result && typeof result === 'object' && 'deleted' in result && result.deleted) {
        skippedCount++
        console.log(`[Import Metrics] ⊘ Skipped issue ${issue.id}: Campaign no longer exists in MailerLite`)
      } else {
        successCount++
        console.log(`[Import Metrics] ✓ Successfully imported metrics for issue ${issue.id}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Import Metrics] ✗ Failed to import metrics for issue ${issue.id}:`, errorMessage)
      console.error('[Import Metrics] Error details:', error)
      errors.push(`Issue ${issue.id}: ${errorMessage}`)
      errorCount++
    }
  }

  const result = {
    success: true,
    message: 'Metrics import completed',
    processed: issues.length,
    successful: successCount,
    skipped: skippedCount,
    failed: errorCount,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  }

  console.log('[Import Metrics] Import completed:', result)
  return result
}

// Handle GET requests from Vercel cron
export async function GET(request: NextRequest) {
  console.log('[Import Metrics] GET request received')
  console.log('[Import Metrics] URL:', request.url)
  console.log('[Import Metrics] Headers:', Object.fromEntries(request.headers.entries()))

  // Vercel Cron makes GET requests without auth headers
  // Allow both Vercel cron (no auth) and manual testing (with secret param)
  const searchParams = new URL(request.url).searchParams
  const secret = searchParams.get('secret')

  // Check if this is a manual test with secret
  if (secret && secret !== process.env.CRON_SECRET) {
    console.log('[Import Metrics] Unauthorized: Invalid secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // If secret is provided and valid, or no secret (Vercel cron), proceed
  if (secret) {
    console.log('[Import Metrics] Manual trigger with secret - proceeding')
  } else {
    console.log('[Import Metrics] Vercel cron trigger - proceeding')
  }

  try {
    const result = await executeMetricsImport()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Import Metrics] GET handler error:', error)
    return NextResponse.json({
      error: 'Metrics import failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle POST requests for manual triggers with auth header
export async function POST(request: NextRequest) {
  console.log('[Import Metrics] POST request received')
  
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  console.log('[Import Metrics] Auth header present:', !!authHeader)
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[Import Metrics] Unauthorized: Invalid or missing auth header')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Import Metrics] POST authorized - proceeding')

  try {
    const result = await executeMetricsImport()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Import Metrics] POST handler error:', error)
    return NextResponse.json({
      error: 'Metrics import failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}