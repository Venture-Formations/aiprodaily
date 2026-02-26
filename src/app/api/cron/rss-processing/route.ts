import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { PromptSelector } from '@/lib/prompt-selector'
import type { Logger } from '@/lib/logger'

async function processRSSWorkflow(log: Logger, force: boolean = false) {
  let issueId: string | undefined

  // TODO: This legacy route should be deprecated in favor of trigger-workflow
  // Get first active newsletter for backward compatibility
  const { data: activeNewsletter } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!activeNewsletter) {
    return {
      skipped: true,
      response: NextResponse.json({
        success: false,
        error: 'No active newsletter found',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }
  }

  // Check if it's time to run RSS processing based on database settings
  // Allow bypassing the schedule check with force=true parameter
  if (!force) {
    const shouldRun = await ScheduleChecker.shouldRunRSSProcessing(activeNewsletter.id)

    if (!shouldRun) {
      return {
        skipped: true,
        response: NextResponse.json({
          success: true,
          message: 'Not time to run RSS processing or already ran today',
          skipped: true,
          timestamp: new Date().toISOString()
        })
      }
    }
  } else {
    log.info('[Cron] Force mode enabled - bypassing schedule check')
  }

  // Get tomorrow's date for issue creation (RSS processing is for next day)
  // IMPORTANT: Calculate tomorrow based on Central Time, not UTC
  const now = new Date()
  const centralFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const centralDate = centralFormatter.format(now)
  const centralToday = new Date(centralDate + 'T00:00:00')
  const centralTomorrow = new Date(centralToday)
  centralTomorrow.setDate(centralToday.getDate() + 1)
  const issueDate = centralTomorrow.toISOString().split('T')[0]

  // Get newsletter ID
  const { data: newsletter, error: newsletterError } = await supabaseAdmin
    .from('publications')
    .select('id, name, slug')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (newsletterError || !newsletter) {
    throw new Error(`Failed to fetch newsletter: ${newsletterError?.message || 'No active newsletter found'}`)
  }

  // Create issue
  const { data: newissue, error: issueError } = await supabaseAdmin
    .from('publication_issues')
    .insert([{
      date: issueDate,
      status: 'processing',
      publication_id: newsletter.id
    }])
    .select()
    .single()

  if (issueError || !newissue) {
    throw new Error(`Failed to create issue: ${issueError?.message}`)
  }

  issueId = newissue.id

  if (!issueId) {
    throw new Error('issueId is required but was not set')
  }

  // Select prompt and AI apps for the issue
  await PromptSelector.selectPromptForissue(issueId)
  try {
    const { AppModuleSelector } = await import('@/lib/ai-app-modules')
    await AppModuleSelector.selectAppsForIssue(issueId, newsletter.id, new Date())
  } catch (appSelectionError) {
    log.error({ err: appSelectionError }, 'AI app selection failed')
  }

  // Construct base URL - always use production URL for internal requests
  // Preview deployments require authentication, so we use the production domain
  let baseUrl: string
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('-venture-formations')) {
    // NEXTAUTH_URL set and not a preview URL
    baseUrl = process.env.NEXTAUTH_URL
  } else {
    // Default to production domain (hardcoded to avoid preview auth issues)
    baseUrl = process.env.PRODUCTION_URL || 'https://aiprodaily.vercel.app'
  }

  // Phase 1: Archive, Fetch+Extract, Score (steps 1-3)
  log.info({ issueId, baseUrl }, '[Cron] Phase 1 starting')

  const phase1Url = `${baseUrl}/api/rss/process-phase1`

  let phase1Response: Response
  try {
    log.info('[Cron] Making Phase 1 fetch request')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutes

    try {
      phase1Response = await fetch(phase1Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'X-Correlation-ID': log.correlationId,
        },
        body: JSON.stringify({ issue_id: issueId }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      log.info({ status: phase1Response.status }, '[Cron] Phase 1 fetch completed')
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        log.error('[Cron] Phase 1 fetch timed out after 10 minutes')
        throw new Error('Phase 1 fetch timed out after 10 minutes')
      }
      throw fetchError
    }
  } catch (fetchError) {
    log.error({ err: fetchError }, '[Cron] Phase 1 fetch failed')
    throw new Error(`Phase 1 fetch failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
  }

  // Check if response is JSON or HTML (error page)
  const contentType = phase1Response.headers.get('content-type') || ''
  let phase1Result: any

  try {
    if (contentType.includes('application/json')) {
      phase1Result = await phase1Response.json()
    } else {
      const text = await phase1Response.text()
      log.error({ status: phase1Response.status, body: text.substring(0, 500) }, '[Cron] Phase 1 returned HTML instead of JSON')
      throw new Error(`Phase 1 returned non-JSON response (${phase1Response.status}): ${text.substring(0, 200)}`)
    }
  } catch (parseError) {
    log.error({ err: parseError }, '[Cron] Failed to parse Phase 1 response')
    throw new Error(`Phase 1 response parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
  }

  if (!phase1Response.ok) {
    log.error({ result: phase1Result }, '[Cron] Phase 1 returned error status')
    throw new Error(`Phase 1 failed: ${phase1Result.message || JSON.stringify(phase1Result)}`)
  }

  log.info({ issueId }, '[Cron] Phase 1 completed')

  // Phase 2: Deduplicate, Generate, Select+Subject, Welcome, Finalize (steps 4-8)
  log.info({ issueId }, '[Cron] Phase 2 starting')

  const phase2Url = `${baseUrl}/api/rss/process-phase2`

  let phase2Response: Response
  try {
    log.info('[Cron] Making Phase 2 fetch request')
    const controller2 = new AbortController()
    const timeoutId2 = setTimeout(() => controller2.abort(), 600000) // 10 minutes

    try {
      phase2Response = await fetch(phase2Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'X-Correlation-ID': log.correlationId,
        },
        body: JSON.stringify({ issue_id: issueId }),
        signal: controller2.signal
      })
      clearTimeout(timeoutId2)
      log.info({ status: phase2Response.status }, '[Cron] Phase 2 response received')
    } catch (fetchError: any) {
      clearTimeout(timeoutId2)
      if (fetchError.name === 'AbortError') {
        log.error('[Cron] Phase 2 fetch timed out after 10 minutes')
        throw new Error('Phase 2 fetch timed out after 10 minutes')
      }
      throw fetchError
    }
  } catch (fetchError) {
    log.error({ err: fetchError }, '[Cron] Phase 2 fetch failed')
    throw new Error(`Phase 2 fetch failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
  }

  // Check if response is JSON or HTML (error page)
  const contentType2 = phase2Response.headers.get('content-type') || ''
  let phase2Result: any

  if (contentType2.includes('application/json')) {
    phase2Result = await phase2Response.json()
  } else {
    const text = await phase2Response.text()
    log.error({ status: phase2Response.status, body: text.substring(0, 500) }, '[Cron] Phase 2 returned HTML instead of JSON')
    throw new Error(`Phase 2 returned non-JSON response (${phase2Response.status}): ${text.substring(0, 200)}`)
  }

  if (!phase2Response.ok) {
    throw new Error(`Phase 2 failed: ${phase2Result.message || JSON.stringify(phase2Result)}`)
  }

  log.info({ issueId }, '[Cron] Phase 2 completed')

  return {
    skipped: false,
    response: NextResponse.json({
      success: true,
      message: 'Full RSS processing workflow completed successfully',
      issueId: issueId,
      issueDate: issueDate,
      phase1_results: phase1Result.results,
      phase2_results: phase2Result.results,
      timestamp: new Date().toISOString()
    }),
    issueId
  }
}

const handler = withApiHandler(
  { authTier: 'system', logContext: 'rss-processing' },
  async ({ request, logger }) => {
    let issueId: string | undefined

    try {
      const searchParams = new URL(request.url).searchParams
      const forceParam = searchParams.get('force')
      const force = forceParam === 'true'

      const result = await processRSSWorkflow(logger, force)
      if (result.skipped) {
        return result.response
      }

      issueId = result.issueId
      return result.response
    } catch (error) {
      logger.error({ err: error }, 'RSS processing failed')

      // Try to mark issue as failed if issueId is available
      if (issueId) {
        try {
          await supabaseAdmin
            .from('publication_issues')
            .update({ status: 'failed' })
            .eq('id', issueId)
        } catch (updateError) {
          logger.error({ err: updateError }, 'Failed to update issue status')
        }
      }

      return NextResponse.json({
        success: false,
        error: 'RSS processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        issue_id: issueId,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
  }
)

export const POST = handler
export const GET = handler
