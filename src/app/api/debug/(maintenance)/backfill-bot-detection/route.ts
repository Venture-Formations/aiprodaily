import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { checkUserAgent } from '@/lib/bot-detection'

/**
 * Backfill Bot Detection Data
 *
 * POST /api/debug/backfill-bot-detection
 *
 * 1. Updates existing link_clicks with bot UA flags
 * 2. Identifies IPs with velocity patterns and auto-excludes them
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/backfill-bot-detection' },
  async ({ request, logger }) => {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = {
      uaBackfill: { processed: 0, flagged: 0, errors: 0 },
      velocityDetection: { ipsChecked: 0, ipsExcluded: 0, errors: 0 }
    }

    // ========== PART 1: Backfill UA Detection ==========
    console.log('[Backfill] Starting UA detection backfill...')

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      // Fetch clicks that haven't been checked yet (is_bot_ua is null or false and no reason)
      const { data: clicks, error: fetchError } = await supabaseAdmin
        .from('link_clicks')
        .select('id, user_agent')
        .is('bot_ua_reason', null)
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (fetchError) {
        console.error('[Backfill] Error fetching clicks:', fetchError)
        results.uaBackfill.errors++
        break
      }

      if (!clicks || clicks.length === 0) {
        hasMore = false
        break
      }

      // Process each click
      for (const click of clicks) {
        const uaCheck = checkUserAgent(click.user_agent)
        results.uaBackfill.processed++

        if (uaCheck.isBot) {
          // Update the click with bot flag
          const { error: updateError } = await supabaseAdmin
            .from('link_clicks')
            .update({
              is_bot_ua: true,
              bot_ua_reason: uaCheck.reason
            })
            .eq('id', click.id)

          if (updateError) {
            console.error('[Backfill] Error updating click:', updateError)
            results.uaBackfill.errors++
          } else {
            results.uaBackfill.flagged++
          }
        } else {
          // Mark as checked (set reason to 'checked' to skip in future runs)
          // Actually, we'll just leave it as-is since is_bot_ua defaults to false
        }
      }

      offset += BATCH_SIZE
      hasMore = clicks.length === BATCH_SIZE

      // Log progress
      if (results.uaBackfill.processed % 5000 === 0) {
        console.log(`[Backfill] UA progress: ${results.uaBackfill.processed} processed, ${results.uaBackfill.flagged} flagged`)
      }
    }

    console.log(`[Backfill] UA detection complete: ${results.uaBackfill.processed} processed, ${results.uaBackfill.flagged} flagged`)

    // ========== PART 2: Historical Velocity Detection ==========
    console.log('[Backfill] Starting velocity detection...')

    // Find IPs with suspicious velocity patterns
    // We'll use a direct query approach to find IPs with high click counts per issue
    console.log('[Backfill] Running velocity detection query...')

    // Get all unique IPs with their click patterns per issue
    const { data: ipClickCounts, error: countError } = await supabaseAdmin
      .from('link_clicks')
      .select('ip_address, issue_id, publication_id')
      .not('ip_address', 'is', null)
      .not('issue_id', 'is', null)
      .not('publication_id', 'is', null)

    if (countError) {
      console.error('[Backfill] Error fetching IP data:', countError)
      results.velocityDetection.errors++
    } else if (ipClickCounts) {
      // Group by IP + issue and count
      const ipIssueGroups = new Map<string, {
        ip: string
        issueId: string
        publicationId: string
        count: number
      }>()

      for (const click of ipClickCounts) {
        const key = `${click.ip_address}:${click.issue_id}`
        const existing = ipIssueGroups.get(key)
        if (existing) {
          existing.count++
        } else {
          ipIssueGroups.set(key, {
            ip: click.ip_address,
            issueId: click.issue_id,
            publicationId: click.publication_id,
            count: 1
          })
        }
      }

      // Find IPs with 10+ clicks on a single issue (likely bots)
      const suspiciousEntries = Array.from(ipIssueGroups.values())
        .filter(entry => entry.count >= 10)

      // Get unique IPs to exclude
      const ipsToExclude = new Map<string, { ip: string, publicationId: string, count: number }>()
      for (const entry of suspiciousEntries) {
        const existing = ipsToExclude.get(`${entry.ip}:${entry.publicationId}`)
        if (!existing || entry.count > existing.count) {
          ipsToExclude.set(`${entry.ip}:${entry.publicationId}`, {
            ip: entry.ip,
            publicationId: entry.publicationId,
            count: entry.count
          })
        }
      }

      results.velocityDetection.ipsChecked = ipsToExclude.size

      // Add suspicious IPs to exclusion list
      for (const entry of Array.from(ipsToExclude.values())) {
        // Check if already excluded
        const { data: existing } = await supabaseAdmin
          .from('excluded_ips')
          .select('id')
          .eq('publication_id', entry.publicationId)
          .eq('ip_address', entry.ip)
          .maybeSingle()

        if (!existing) {
          const { error: insertError } = await supabaseAdmin
            .from('excluded_ips')
            .insert({
              publication_id: entry.publicationId,
              ip_address: entry.ip,
              is_range: false,
              cidr_prefix: null,
              reason: `Historical velocity: ${entry.count}+ clicks on single issue`,
              added_by: 'system:backfill',
              exclusion_source: 'velocity'
            })

          if (insertError) {
            // Ignore duplicate key errors
            if (!insertError.message?.includes('duplicate')) {
              console.error('[Backfill] Error excluding IP:', insertError)
              results.velocityDetection.errors++
            }
          } else {
            results.velocityDetection.ipsExcluded++
            console.log(`[Backfill] Excluded IP ${entry.ip} (${entry.count} clicks)`)
          }
        }
      }
    }

    console.log(`[Backfill] Velocity detection complete: ${results.velocityDetection.ipsChecked} checked, ${results.velocityDetection.ipsExcluded} excluded`)

    return NextResponse.json({
      success: true,
      results,
      message: `Backfill complete. UA: ${results.uaBackfill.flagged}/${results.uaBackfill.processed} flagged. Velocity: ${results.velocityDetection.ipsExcluded} IPs excluded.`
    })

  } catch (error) {
    console.error('[Backfill] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
  }
)

/**
 * DELETE - Remove velocity-based exclusions (rollback)
 * These were too aggressive and may have caught legitimate users
 */
export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/backfill-bot-detection' },
  async ({ request, logger }) => {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count velocity exclusions before deletion
    const { count: beforeCount } = await supabaseAdmin
      .from('excluded_ips')
      .select('*', { count: 'exact', head: true })
      .eq('exclusion_source', 'velocity')

    // Delete all velocity-based exclusions
    const { error } = await supabaseAdmin
      .from('excluded_ips')
      .delete()
      .eq('exclusion_source', 'velocity')

    if (error) {
      console.error('[Backfill] Error removing velocity exclusions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Backfill] Removed ${beforeCount || 0} velocity-based IP exclusions`)

    return NextResponse.json({
      success: true,
      removed: beforeCount || 0,
      message: `Removed ${beforeCount || 0} velocity-based IP exclusions. Real-time velocity detection (5 clicks in 10 seconds) will still work for new clicks.`
    })

  } catch (error) {
    console.error('[Backfill] Rollback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
  }
)

/**
 * GET - Check backfill status / preview what would be processed
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/backfill-bot-detection' },
  async ({ request, logger }) => {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count clicks needing UA check
    const { count: uncheckedCount } = await supabaseAdmin
      .from('link_clicks')
      .select('*', { count: 'exact', head: true })
      .is('bot_ua_reason', null)

    // Count already flagged as bot
    const { count: botCount } = await supabaseAdmin
      .from('link_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot_ua', true)

    // Count IPs with high click counts per issue
    const { data: highClickIps } = await supabaseAdmin
      .from('link_clicks')
      .select('ip_address, issue_id')
      .not('ip_address', 'is', null)
      .not('issue_id', 'is', null)

    // Group and count
    const ipIssueCounts = new Map<string, number>()
    highClickIps?.forEach(click => {
      const key = `${click.ip_address}:${click.issue_id}`
      ipIssueCounts.set(key, (ipIssueCounts.get(key) || 0) + 1)
    })

    const suspiciousIpCount = Array.from(ipIssueCounts.values()).filter(c => c >= 10).length

    // Count already excluded IPs
    const { count: excludedCount } = await supabaseAdmin
      .from('excluded_ips')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      status: 'ready',
      preview: {
        clicksToCheck: uncheckedCount || 0,
        alreadyFlaggedAsBot: botCount || 0,
        suspiciousIpPatterns: suspiciousIpCount,
        currentlyExcludedIps: excludedCount || 0
      },
      instructions: 'POST to this endpoint to run the backfill'
    })

  } catch (error) {
    console.error('[Backfill] Preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
  }
)
