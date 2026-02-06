/**
 * Velocity-Based Bot Detection
 * Detects rapid automated clicks from the same IP address
 */

import { supabaseAdmin } from '@/lib/supabase'
import { VELOCITY_THRESHOLD } from './constants'

export interface VelocityCheckParams {
  ipAddress: string
  issueId: string
  publicationId: string
}

/**
 * Checks for suspicious click velocity and auto-excludes IP if threshold exceeded
 *
 * Detects when same IP clicks 5+ different links from same issue within 10 seconds,
 * which indicates automated/bot behavior (humans can't click that fast).
 *
 * This function is designed to be fire-and-forget - it logs errors but doesn't throw.
 *
 * @param params - IP address, issue ID, and publication ID to check
 */
export async function checkAndAutoExcludeVelocity(params: VelocityCheckParams): Promise<void> {
  const { ipAddress, issueId, publicationId } = params

  try {
    // Calculate time window
    const windowStart = new Date(
      Date.now() - VELOCITY_THRESHOLD.TIME_WINDOW_SECONDS * 1000
    ).toISOString()

    // Query for recent clicks from this IP for this issue
    const { data: recentClicks, error: queryError } = await supabaseAdmin
      .from('link_clicks')
      .select('link_url')
      .eq('ip_address', ipAddress)
      .eq('issue_id', issueId)
      .gte('clicked_at', windowStart)

    if (queryError) {
      console.error('[Velocity] Query error:', queryError.message)
      return
    }

    if (!recentClicks || recentClicks.length < VELOCITY_THRESHOLD.MIN_CLICKS) {
      // Not enough clicks to trigger velocity detection
      return
    }

    // Count distinct URLs
    const distinctUrls = new Set(recentClicks.map(c => c.link_url))

    if (distinctUrls.size < VELOCITY_THRESHOLD.MIN_CLICKS) {
      // Not enough distinct URLs (could be multiple clicks on same link)
      return
    }

    // Velocity threshold exceeded - check if already excluded
    const { data: existing } = await supabaseAdmin
      .from('excluded_ips')
      .select('id')
      .eq('publication_id', publicationId)
      .eq('ip_address', ipAddress)
      .maybeSingle()

    if (existing) {
      // Already excluded, no need to add again
      console.log(`[Velocity] IP ${ipAddress} already excluded`)
      return
    }

    // Auto-exclude the IP
    const { error: insertError } = await supabaseAdmin
      .from('excluded_ips')
      .insert({
        publication_id: publicationId,
        ip_address: ipAddress,
        is_range: false,
        cidr_prefix: null,
        reason: `Velocity detection: ${distinctUrls.size} distinct URLs in ${VELOCITY_THRESHOLD.TIME_WINDOW_SECONDS}s`,
        added_by: 'system:velocity',
        exclusion_source: 'velocity'
      })

    if (insertError) {
      console.error('[Velocity] Insert error:', insertError.message)
      return
    }

    console.log(
      `[Velocity] Auto-excluded IP ${ipAddress}: ${distinctUrls.size} clicks in ${VELOCITY_THRESHOLD.TIME_WINDOW_SECONDS}s`
    )
  } catch (error) {
    console.error('[Velocity] Unexpected error:', error instanceof Error ? error.message : error)
  }
}
