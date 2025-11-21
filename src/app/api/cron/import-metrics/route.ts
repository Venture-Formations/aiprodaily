import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

async function executeMetricsImport() {
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
    return {
      success: true,
      message: 'No sent issues to import metrics for',
      processed: 0,
      successful: 0,
      skipped: 0,
      failed: 0,
      timestamp: new Date().toISOString()
    }
  }

  console.log(`[Metrics Import] Processing ${issues.length} issues from last 30 days`)

  const mailerLiteService = new MailerLiteService()
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0
  const errors: string[] = []

  for (const issue of issues) {
    try {
      console.log(`[Metrics Import] Processing issue ${issue.id} (sent at: ${issue.final_sent_at})`)
      const result = await mailerLiteService.importissueMetrics(issue.id)
      
      // Check if result indicates a skip
      if (result && typeof result === 'object' && 'skipped' in result && result.skipped) {
        skippedCount++
      } else {
        successCount++
      }
    } catch (error: any) {
      // Handle skip indicators
      if (error && typeof error === 'object' && 'skipped' in error && error.skipped) {
        skippedCount++
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Issue ${issue.id}: ${errorMessage}`)
        errorCount++
      }
    }
  }

  return {
    success: true,
    message: 'Metrics import completed',
    processed: issues.length,
    successful: successCount,
    skipped: skippedCount,
    failed: errorCount,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  }
}

// Handle GET requests from Vercel cron
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const secret = searchParams.get('secret')

  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await executeMetricsImport()
    return NextResponse.json(result)
  } catch (error) {
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
    const result = await executeMetricsImport()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({
      error: 'Metrics import failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}