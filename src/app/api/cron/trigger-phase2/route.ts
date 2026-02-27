import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { updateIssueStatus } from '@/lib/dal/issues'
import type { Logger } from '@/lib/logger'

/**
 * Cron job to automatically trigger Phase 2 for campaigns that completed Phase 1
 *
 * Runs every 3 minutes, checks for issues with status = 'pending_phase2'
 * and triggers Phase 2 for them.
 */
async function handleTriggerPhase2(logger: Logger) {
  console.log('[Cron] Checking for issues ready for Phase 2...')

  // Find issues with status = 'pending_phase2'
  const { data: issues, error } = await supabaseAdmin
    .from('publication_issues')
    .select('id, date, updated_at')
    .eq('status', 'pending_phase2')
    .order('updated_at', { ascending: true })

  if (error) {
    console.error('[Cron] Error fetching pending issues:', error)
    throw error
  }

  if (!issues || issues.length === 0) {
    console.log('[Cron] No issues ready for Phase 2')
    return NextResponse.json({
      success: true,
      message: 'No issues ready for Phase 2',
      issues_checked: 0
    })
  }

  console.log(`[Cron] Found ${issues.length} issue(s) ready for Phase 2`)

  // Trigger Phase 2 for each issue
  const results = []

  for (const issue of issues) {
    console.log(`[Cron] Triggering Phase 2 for issue: ${issue.id}`)

    // Mark as processing to prevent duplicate triggers (atomic CAS)
    const transitioned = await updateIssueStatus(issue.id, 'processing', {
      expectedCurrentStatus: 'pending_phase2',
    })
    if (!transitioned) {
      console.log(`[Cron] Issue ${issue.id} status already changed, skipping`)
      results.push({ issue_id: issue.id, status: 'skipped', message: 'Status already changed' })
      continue
    }

    // Trigger Phase 2
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                   process.env.PRODUCTION_URL ||
                   'https://aiprodaily.vercel.app'

    const phase2Url = `${baseUrl}/api/rss/process-phase2`

    // Trigger Phase 2 in fire-and-forget mode (don't wait for completion)
    fetch(phase2Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ issue_id: issue.id })
    }).catch(error => {
      // Log error but don't fail the cron
      console.error(`[Cron] Failed to trigger Phase 2 for issue ${issue.id}:`, error)
      // Phase 2 will handle its own status updates, including failures
    })

    console.log(`[Cron] Phase 2 trigger sent for issue: ${issue.id}`)
    results.push({
      issue_id: issue.id,
      status: 'triggered',
      message: 'Phase 2 trigger sent (fire-and-forget)'
    })
  }

  return NextResponse.json({
    success: true,
    message: `Processed ${issues.length} issue(s)`,
    issues_checked: issues.length,
    results
  })
}

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'trigger-phase2' },
  async ({ logger }) => handleTriggerPhase2(logger)
)

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'trigger-phase2' },
  async ({ logger }) => handleTriggerPhase2(logger)
)
